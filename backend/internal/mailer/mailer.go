// Package mailer mengirim email transaksional melalui SMTP (mis. Gmail).
//
// Implementasi memakai standard library sehingga tidak menambah dependensi.
// Koneksi selalu dilindungi STARTTLS; kredensial tidak pernah dikirim tanpa
// enkripsi.
package mailer

import (
	"crypto/tls"
	"errors"
	"fmt"
	"html"
	"log"
	"mime"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"manajemen-puyuh/backend/internal/config"
	"manajemen-puyuh/backend/internal/models"
)

// ErrDisabled dikembalikan bila SMTP belum dikonfigurasi.
var ErrDisabled = errors.New("pengiriman email belum dikonfigurasi")

type Mailer struct {
	host        string
	port        int
	user        string
	pass        string
	fromAddress string
	fromHeader  string
	baseURL     string
	enabled     bool
}

func New(cfg *config.Config) *Mailer {
	from := extractAddress(cfg.MailFrom)
	if from == "" {
		from = cfg.SMTPUser
	}
	header := from
	if from != "" {
		header = fmt.Sprintf("Manajemen Puyuh <%s>", from)
	}
	return &Mailer{
		host:        cfg.SMTPHost,
		port:        cfg.SMTPPort,
		user:        cfg.SMTPUser,
		pass:        cfg.SMTPPass,
		fromAddress: from,
		fromHeader:  header,
		baseURL:     cfg.AppBaseURL,
		enabled:     cfg.MailEnabled(),
	}
}

// Enabled menandakan apakah email benar-benar bisa dikirim.
func (m *Mailer) Enabled() bool { return m != nil && m.enabled }

// Send mengirim satu email HTML. Koneksi memakai STARTTLS pada port SMTP
// (umumnya 587 untuk Gmail).
func (m *Mailer) Send(to, subject, htmlBody string) error {
	if !m.Enabled() {
		return ErrDisabled
	}
	address := net.JoinHostPort(m.host, strconv.Itoa(m.port))
	conn, err := net.DialTimeout("tcp", address, 10*time.Second)
	if err != nil {
		return fmt.Errorf("tidak dapat terhubung ke server SMTP: %w", err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(45 * time.Second))

	client, err := smtp.NewClient(conn, m.host)
	if err != nil {
		return fmt.Errorf("gagal membuka sesi SMTP: %w", err)
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); !ok {
		return errors.New("server SMTP tidak mendukung STARTTLS")
	}
	if err := client.StartTLS(&tls.Config{ServerName: m.host, MinVersion: tls.VersionTLS12}); err != nil {
		return fmt.Errorf("gagal memulai TLS: %w", err)
	}
	if err := client.Auth(smtp.PlainAuth("", m.user, m.pass, m.host)); err != nil {
		return fmt.Errorf("autentikasi SMTP gagal: %w", err)
	}
	if err := client.Mail(m.fromAddress); err != nil {
		return fmt.Errorf("pengirim ditolak SMTP: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("penerima ditolak SMTP: %w", err)
	}
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("gagal membuka isi email: %w", err)
	}
	if _, err := writer.Write(m.message(to, subject, htmlBody)); err != nil {
		_ = writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	if err := client.Quit(); err != nil {
		return err
	}
	return nil
}

// SendAsync mengirim email di latar belakang agar request API tidak menunggu.
func (m *Mailer) SendAsync(to, subject, htmlBody string) {
	if !m.Enabled() {
		return
	}
	go func() {
		if err := m.Send(to, subject, htmlBody); err != nil {
			log.Printf("gagal mengirim email ke %s: %v", to, err)
		}
	}()
}

// SendVerification mengirim tautan verifikasi akun.
func (m *Mailer) SendVerification(to, name, token string) error {
	link := fmt.Sprintf("%s/verifikasi-email?token=%s", m.baseURL, token)
	body := verificationTemplate(name, link, m.baseURL)
	return m.Send(to, "Verifikasi email akun Manajemen Puyuh", body)
}

// WarningSubject membuat subjek email untuk warning kritis.
func WarningSubject(farmName string, events []models.WarningEvent) string {
	label := "Warning kritis"
	if farmName != "" {
		label = "Warning kritis - " + farmName
	}
	if len(events) > 1 {
		return fmt.Sprintf("%s (%d peringatan)", label, len(events))
	}
	if len(events) == 1 {
		return label + ": " + events[0].Title
	}
	return label
}

// WarningBody membuat isi email berisi daftar warning kritis.
func (m *Mailer) WarningBody(ownerName, farmName string, events []models.WarningEvent) string {
	greeting := "Halo"
	if ownerName != "" {
		greeting = "Halo " + ownerName
	}
	var items strings.Builder
	for _, event := range events {
		items.WriteString(fmt.Sprintf(
			`<tr><td style="padding:12px 0;border-bottom:1px solid #ececec;">`+
				`<p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#b91c1c;">%s</p>`+
				`<p style="margin:0;font-size:13px;line-height:1.6;color:#57534e;">%s</p>`+
				`<p style="margin:6px 0 0;font-size:11px;color:#a8a29e;">%s</p></td></tr>`,
			html.EscapeString(event.Title),
			html.EscapeString(event.Description),
			html.EscapeString(event.EventDate.String()),
		))
	}
	content := fmt.Sprintf(
		`<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#44403c;">%s,</p>`+
			`<p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#44403c;">`+
			`Sistem mendeteksi peringatan <strong>kritis</strong> pada kandang <strong>%s</strong>. `+
			`Mohon segera periksa kondisi kandang.</p>`+
			`<table role="presentation" width="100%%" cellpadding="0" cellspacing="0">%s</table>`+
			`<p style="margin:24px 0 0;font-size:12px;line-height:1.7;color:#78716c;">`+
			`Buka aplikasi untuk melihat detail dan menandai warning sudah diperiksa.</p>`,
		html.EscapeString(greeting),
		html.EscapeString(farmName),
		items.String(),
	)
	return layout("Peringatan Kritis", content, m.baseURL)
}

func verificationTemplate(name, link, baseURL string) string {
	greeting := "Halo"
	if name != "" {
		greeting = "Halo " + name
	}
	content := fmt.Sprintf(
		`<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#44403c;">%s,</p>`+
			`<p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#44403c;">`+
			`Terima kasih sudah mendaftar di <strong>Manajemen Puyuh</strong>. `+
			`Klik tombol di bawah untuk memverifikasi email Anda.</p>`+
			`<p style="margin:0 0 24px;"><a href="%s" style="display:inline-block;padding:12px 22px;`+
			`border-radius:10px;background:#047857;color:#ffffff;font-size:14px;font-weight:600;`+
			`text-decoration:none;">Verifikasi email</a></p>`+
			`<p style="margin:0 0 8px;font-size:12px;line-height:1.7;color:#78716c;">`+
			`Tautan berlaku selama 24 jam. Bila tombol tidak berfungsi, salin alamat berikut:</p>`+
			`<p style="margin:0;font-size:12px;line-height:1.7;word-break:break-all;color:#047857;">%s</p>`,
		html.EscapeString(greeting),
		html.EscapeString(link),
		html.EscapeString(link),
	)
	return layout("Verifikasi Email", content, baseURL)
}

func layout(title, content, baseURL string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>%s</title></head>
<body style="margin:0;padding:0;background:#f7f7f4;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f7f7f4;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e7e5e4;">
<tr><td style="padding:24px 28px 8px;">
<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#047857;">Manajemen Usaha</p>
<p style="margin:4px 0 0;font-size:18px;font-weight:700;color:#1c1917;">Telur Puyuh</p>
</td></tr>
<tr><td style="padding:16px 28px 28px;">%s</td></tr>
</table>
<p style="margin:16px 0 0;font-size:11px;color:#a8a29e;">Email otomatis dari %s</p>
</td></tr></table></body></html>`, html.EscapeString(title), content, html.EscapeString(baseURL))
}

func (m *Mailer) message(to, subject, htmlBody string) []byte {
	var builder strings.Builder
	writer := func(header, value string) {
		builder.WriteString(header)
		builder.WriteString(": ")
		builder.WriteString(value)
		builder.WriteString("\r\n")
	}
	writer("From", m.fromHeader)
	writer("To", to)
	writer("Subject", mime.QEncoding.Encode("utf-8", subject))
	writer("Date", time.Now().Format(time.RFC1123Z))
	writer("MIME-Version", "1.0")
	writer("Content-Type", `text/html; charset="UTF-8"`)
	writer("Content-Transfer-Encoding", "8bit")
	builder.WriteString("\r\n")
	builder.WriteString(htmlBody)
	return []byte(builder.String())
}

func extractAddress(value string) string {
	value = strings.TrimSpace(value)
	if start := strings.LastIndex(value, "<"); start >= 0 {
		if end := strings.Index(value[start:], ">"); end > 0 {
			return strings.TrimSpace(value[start+1 : start+end])
		}
	}
	return value
}
