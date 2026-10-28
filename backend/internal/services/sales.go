package services

import (
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/models"
)

type SalesService struct {
	db *gorm.DB
}

func NewSalesService(db *gorm.DB) *SalesService { return &SalesService{db: db} }

type PickupInput struct {
	PickupDate   models.Date `json:"pickup_date"`
	EggCount     int         `json:"egg_count"`
	PricePerUnit *float64    `json:"price_per_unit"`
	Status       string      `json:"status"`
	Notes        string      `json:"notes"`
}

type PickupFilter struct {
	From   models.Date
	To     models.Date
	Status string
	Page   int
	Limit  int
}

func (s *SalesService) validatePickup(input *PickupInput) error {
	if err := ValidateRecordDate(input.PickupDate, "tanggal pengambilan"); err != nil {
		return err
	}
	if err := ValidatePositive(input.EggCount, "jumlah telur"); err != nil {
		return err
	}
	if input.PricePerUnit != nil && *input.PricePerUnit < 0 {
		return apperr.BadRequest("harga per satuan tidak boleh negatif")
	}
	if input.Status == "" {
		input.Status = models.PickupPending
	}
	if input.Status != models.PickupPending && input.Status != models.PickupInvoiced {
		return apperr.BadRequest("status pengambilan tidak valid")
	}
	input.Notes = strings.TrimSpace(input.Notes)
	return nil
}

func (s *SalesService) ListPickups(filter PickupFilter) ([]models.EggPickup, int64, error) {
	query := s.db.Model(&models.EggPickup{}).Where("pickup_date BETWEEN ? AND ?", filter.From, filter.To)
	if filter.Status != "" && filter.Status != "all" {
		query = query.Where("status = ?", filter.Status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var data []models.EggPickup
	if err := query.Order("pickup_date DESC, id DESC").
		Offset((filter.Page - 1) * filter.Limit).Limit(filter.Limit).
		Find(&data).Error; err != nil {
		return nil, 0, err
	}
	return data, total, nil
}

func (s *SalesService) GetPickup(id uint) (*models.EggPickup, error) {
	var pickup models.EggPickup
	if err := s.db.First(&pickup, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("pengambilan telur tidak ditemukan")
		}
		return nil, err
	}
	return &pickup, nil
}

func (s *SalesService) CreatePickup(actor Actor, input PickupInput) (*models.EggPickup, error) {
	if err := s.validatePickup(&input); err != nil {
		return nil, err
	}
	pickup := models.EggPickup{
		PickupDate: input.PickupDate, EggCount: input.EggCount,
		PricePerUnit: input.PricePerUnit, Status: input.Status, Notes: input.Notes,
	}
	if err := s.db.Create(&pickup).Error; err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "create", "pickup", pickup.ID,
		"Pengambilan "+itoa(pickup.EggCount)+" telur tanggal "+pickup.PickupDate.String())
	return &pickup, nil
}

func (s *SalesService) UpdatePickup(actor Actor, id uint, input PickupInput) (*models.EggPickup, error) {
	pickup, err := s.GetPickup(id)
	if err != nil {
		return nil, err
	}
	if err := s.validatePickup(&input); err != nil {
		return nil, err
	}
	pickup.PickupDate = input.PickupDate
	pickup.EggCount = input.EggCount
	pickup.PricePerUnit = input.PricePerUnit
	pickup.Status = input.Status
	pickup.Notes = input.Notes
	if err := s.db.Save(pickup).Error; err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "update", "pickup", id,
		"Mengubah pengambilan tanggal "+pickup.PickupDate.String()+" menjadi "+itoa(pickup.EggCount)+" telur")
	return pickup, nil
}

func (s *SalesService) DeletePickup(actor Actor, id uint) error {
	pickup, err := s.GetPickup(id)
	if err != nil {
		return err
	}
	var linked int64
	if err := s.db.Table("sales_note_pickups").Where("egg_pickup_id = ?", id).Count(&linked).Error; err != nil {
		return err
	}
	if linked > 0 {
		return apperr.Conflict("pengambilan sudah terhubung dengan nota, lepaskan dari nota terlebih dahulu")
	}
	if err := s.db.Delete(pickup).Error; err != nil {
		return err
	}
	LogActivity(s.db, actor, "delete", "pickup", id, "Menghapus pengambilan tanggal "+pickup.PickupDate.String())
	return nil
}

type SalesNoteInput struct {
	NoteNumber    string       `json:"note_number"`
	NoteDate      models.Date  `json:"note_date"`
	PeriodStart   *models.Date `json:"period_start"`
	PeriodEnd     *models.Date `json:"period_end"`
	TotalEggs     int          `json:"total_eggs"`
	TotalAmount   float64      `json:"total_amount"`
	FeedDeduction float64      `json:"feed_deduction"`
	Notes         string       `json:"notes"`
	PickupIDs     []uint       `json:"pickup_ids"`
}

type NoteFilter struct {
	From   models.Date
	To     models.Date
	Search string
	Page   int
	Limit  int
}

func (s *SalesService) validateNote(input *SalesNoteInput, noteID uint) ([]models.EggPickup, error) {
	input.NoteNumber = strings.TrimSpace(input.NoteNumber)
	if input.NoteNumber == "" {
		return nil, apperr.BadRequest("nomor nota wajib diisi")
	}
	if err := ValidateRecordDate(input.NoteDate, "tanggal nota"); err != nil {
		return nil, err
	}
	if input.TotalAmount < 0 || input.FeedDeduction < 0 {
		return nil, apperr.BadRequest("nilai nota dan potongan tidak boleh negatif")
	}
	if input.TotalEggs < 0 {
		return nil, apperr.BadRequest("total telur tidak boleh negatif")
	}
	if input.PeriodStart != nil && input.PeriodEnd != nil && input.PeriodStart.After(*input.PeriodEnd) {
		return nil, apperr.BadRequest("awal periode tidak boleh melebihi akhir periode")
	}

	var duplicate int64
	query := s.db.Model(&models.SalesNote{}).Where("note_number = ?", input.NoteNumber)
	if noteID != 0 {
		query = query.Where("id <> ?", noteID)
	}
	if err := query.Count(&duplicate).Error; err != nil {
		return nil, err
	}
	if duplicate > 0 {
		return nil, apperr.Conflict("nomor nota sudah digunakan")
	}

	input.PickupIDs = uniqueIDs(input.PickupIDs)
	if len(input.PickupIDs) == 0 {
		return nil, nil
	}
	var pickups []models.EggPickup
	if err := s.db.Where("id IN ?", input.PickupIDs).Find(&pickups).Error; err != nil {
		return nil, err
	}
	if len(pickups) != len(input.PickupIDs) {
		return nil, apperr.BadRequest("sebagian pengambilan telur tidak ditemukan")
	}
	var linked int64
	linkQuery := s.db.Table("sales_note_pickups").Where("egg_pickup_id IN ?", input.PickupIDs)
	if noteID != 0 {
		linkQuery = linkQuery.Where("sales_note_id <> ?", noteID)
	}
	if err := linkQuery.Count(&linked).Error; err != nil {
		return nil, err
	}
	if linked > 0 {
		return nil, apperr.Conflict("sebagian pengambilan telur sudah terhubung dengan nota lain")
	}
	if input.TotalEggs == 0 {
		for _, pickup := range pickups {
			input.TotalEggs += pickup.EggCount
		}
	}
	return pickups, nil
}

func (s *SalesService) ListNotes(filter NoteFilter) ([]models.SalesNote, int64, error) {
	query := s.db.Model(&models.SalesNote{}).Where("note_date BETWEEN ? AND ?", filter.From, filter.To)
	if search := strings.TrimSpace(filter.Search); search != "" {
		query = query.Where("LOWER(note_number) LIKE ?", "%"+strings.ToLower(search)+"%")
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var data []models.SalesNote
	if err := query.Preload("Pickups").Order("note_date DESC, id DESC").
		Offset((filter.Page - 1) * filter.Limit).Limit(filter.Limit).
		Find(&data).Error; err != nil {
		return nil, 0, err
	}
	return data, total, nil
}

func (s *SalesService) GetNote(id uint) (*models.SalesNote, error) {
	var note models.SalesNote
	if err := s.db.Preload("Pickups").First(&note, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("nota penjualan tidak ditemukan")
		}
		return nil, err
	}
	return &note, nil
}

func (s *SalesService) CreateNote(actor Actor, input SalesNoteInput) (*models.SalesNote, error) {
	pickups, err := s.validateNote(&input, 0)
	if err != nil {
		return nil, err
	}
	note := models.SalesNote{
		NoteNumber: input.NoteNumber, NoteDate: input.NoteDate,
		PeriodStart: input.PeriodStart, PeriodEnd: input.PeriodEnd,
		TotalEggs: input.TotalEggs, TotalAmount: input.TotalAmount,
		FeedDeduction: input.FeedDeduction, Notes: strings.TrimSpace(input.Notes),
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if len(pickups) > 0 {
			note.Pickups = pickups
		}
		if err := tx.Create(&note).Error; err != nil {
			return err
		}
		if len(input.PickupIDs) > 0 {
			if err := tx.Model(&models.EggPickup{}).Where("id IN ?", input.PickupIDs).
				Update("status", models.PickupInvoiced).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "create", "sales_note", note.ID,
		"Nota "+note.NoteNumber+" senilai "+formatMoney(note.TotalAmount))
	return &note, nil
}

func (s *SalesService) UpdateNote(actor Actor, id uint, input SalesNoteInput) (*models.SalesNote, error) {
	note, err := s.GetNote(id)
	if err != nil {
		return nil, err
	}
	pickups, err := s.validateNote(&input, id)
	if err != nil {
		return nil, err
	}
	oldIDs := make([]uint, 0, len(note.Pickups))
	for _, pickup := range note.Pickups {
		oldIDs = append(oldIDs, pickup.ID)
	}

	note.NoteNumber = input.NoteNumber
	note.NoteDate = input.NoteDate
	note.PeriodStart = input.PeriodStart
	note.PeriodEnd = input.PeriodEnd
	note.TotalEggs = input.TotalEggs
	note.TotalAmount = input.TotalAmount
	note.FeedDeduction = input.FeedDeduction
	note.Notes = strings.TrimSpace(input.Notes)

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(note).Error; err != nil {
			return err
		}
		if err := tx.Model(note).Association("Pickups").Replace(pickups); err != nil {
			return err
		}
		if len(oldIDs) > 0 {
			if err := tx.Model(&models.EggPickup{}).Where("id IN ?", oldIDs).
				Update("status", models.PickupPending).Error; err != nil {
				return err
			}
		}
		if len(input.PickupIDs) > 0 {
			if err := tx.Model(&models.EggPickup{}).Where("id IN ?", input.PickupIDs).
				Update("status", models.PickupInvoiced).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "update", "sales_note", id, "Mengubah nota "+note.NoteNumber)
	return note, nil
}

func (s *SalesService) DeleteNote(actor Actor, id uint) error {
	note, err := s.GetNote(id)
	if err != nil {
		return err
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(note).Association("Pickups").Clear(); err != nil {
			return err
		}
		if len(note.Pickups) > 0 {
			ids := make([]uint, 0, len(note.Pickups))
			for _, pickup := range note.Pickups {
				ids = append(ids, pickup.ID)
			}
			if err := tx.Model(&models.EggPickup{}).Where("id IN ?", ids).
				Update("status", models.PickupPending).Error; err != nil {
				return err
			}
		}
		return tx.Delete(&models.SalesNote{}, id).Error
	})
	if err != nil {
		return err
	}
	LogActivity(s.db, actor, "delete", "sales_note", id, "Menghapus nota "+note.NoteNumber)
	return nil
}

type SalesSummary struct {
	TotalPickups   int     `json:"total_pickups"`
	TotalEggs      int     `json:"total_eggs"`
	AverageEggs    float64 `json:"average_eggs"`
	EstimatedValue float64 `json:"estimated_value"`
	PendingPickups int     `json:"pending_pickups"`
	NoteCount      int     `json:"note_count"`
	TotalRevenue   float64 `json:"total_revenue"`
	FeedDeduction  float64 `json:"feed_deduction"`
}

func (s *SalesService) Summary(from, to models.Date) (*SalesSummary, error) {
	var pickups []models.EggPickup
	if err := s.db.Where("pickup_date BETWEEN ? AND ?", from, to).Find(&pickups).Error; err != nil {
		return nil, err
	}
	summary := &SalesSummary{}
	for _, pickup := range pickups {
		summary.TotalPickups++
		summary.TotalEggs += pickup.EggCount
		if pickup.PricePerUnit != nil {
			summary.EstimatedValue += float64(pickup.EggCount) * *pickup.PricePerUnit
		}
		if pickup.Status == models.PickupPending {
			summary.PendingPickups++
		}
	}
	var notes []models.SalesNote
	if err := s.db.Where("note_date BETWEEN ? AND ?", from, to).Find(&notes).Error; err != nil {
		return nil, err
	}
	for _, note := range notes {
		summary.NoteCount++
		summary.TotalRevenue += note.TotalAmount
		summary.FeedDeduction += note.FeedDeduction
	}
	if summary.TotalPickups > 0 {
		summary.AverageEggs = float64(summary.TotalEggs) / float64(summary.TotalPickups)
	}
	return summary, nil
}

func (s *SalesService) PickupsForLinking(from, to models.Date) ([]models.EggPickup, error) {
	var pickups []models.EggPickup
	err := s.db.Where("pickup_date BETWEEN ? AND ?", from, to).
		Order("pickup_date DESC").Find(&pickups).Error
	return pickups, err
}

func uniqueIDs(ids []uint) []uint {
	seen := map[uint]bool{}
	result := make([]uint, 0, len(ids))
	for _, id := range ids {
		if id != 0 && !seen[id] {
			seen[id] = true
			result = append(result, id)
		}
	}
	return result
}

func formatMoney(value float64) string {
	return fmt.Sprintf("Rp%.0f", value)
}
