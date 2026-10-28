package models

import (
	"database/sql/driver"
	"fmt"
	"strings"
	"time"
)

const DateLayout = "2006-01-02"

// Date adalah tanggal tanpa komponen jam. Disimpan sebagai kolom DATE dan
// diserialisasi sebagai "YYYY-MM-DD" agar konsisten di API.
type Date time.Time

func NewDate(t time.Time) Date {
	return Date(time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC))
}

func DateToday() Date { return NewDate(time.Now()) }

func ParseDate(value string) (Date, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return Date{}, fmt.Errorf("tanggal kosong")
	}
	if t, err := time.ParseInLocation(DateLayout, value, time.UTC); err == nil {
		return NewDate(t), nil
	}
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return NewDate(t), nil
	}
	return Date{}, fmt.Errorf("format tanggal harus YYYY-MM-DD")
}

func (d Date) Time() time.Time { return time.Time(d) }

func (Date) GormDataType() string { return "date" }

func (d Date) IsZero() bool { return time.Time(d).IsZero() }

func (d Date) String() string {
	if d.IsZero() {
		return ""
	}
	return d.Time().Format(DateLayout)
}

func (d Date) AddDays(n int) Date { return NewDate(d.Time().AddDate(0, 0, n)) }

func (d Date) Before(other Date) bool { return d.Time().Before(other.Time()) }

func (d Date) After(other Date) bool { return d.Time().After(other.Time()) }

func (d Date) Equal(other Date) bool { return d.Time().Equal(other.Time()) }

func (d Date) StartOfMonth() Date {
	t := d.Time()
	return NewDate(time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC))
}

func (d Date) EndOfMonth() Date { return d.StartOfMonth().AddDays(31).StartOfMonth().AddDays(-1) }

func (d Date) MarshalJSON() ([]byte, error) {
	if d.IsZero() {
		return []byte("null"), nil
	}
	return []byte(fmt.Sprintf("%q", d.String())), nil
}

func (d *Date) UnmarshalJSON(data []byte) error {
	raw := strings.Trim(string(data), `"`)
	if raw == "" || raw == "null" {
		*d = Date{}
		return nil
	}
	parsed, err := ParseDate(raw)
	if err != nil {
		return err
	}
	*d = parsed
	return nil
}

func (d Date) Value() (driver.Value, error) {
	if d.IsZero() {
		return nil, nil
	}
	return d.Time(), nil
}

func (d *Date) Scan(value any) error {
	if value == nil {
		*d = Date{}
		return nil
	}
	switch v := value.(type) {
	case time.Time:
		*d = NewDate(v)
		return nil
	case string:
		parsed, err := ParseDate(v)
		if err != nil {
			return err
		}
		*d = parsed
		return nil
	case []byte:
		parsed, err := ParseDate(string(v))
		if err != nil {
			return err
		}
		*d = parsed
		return nil
	}
	return fmt.Errorf("tipe tanggal tidak didukung: %T", value)
}
