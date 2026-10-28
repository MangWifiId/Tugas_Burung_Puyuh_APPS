package services

import (
	"errors"
	"strings"

	"gorm.io/gorm"

	"manajemen-puyuh/backend/internal/apperr"
	"manajemen-puyuh/backend/internal/models"
)

type FeedService struct {
	db *gorm.DB
}

func NewFeedService(db *gorm.DB) *FeedService { return &FeedService{db: db} }

type FeedInput struct {
	ReceivedDate models.Date `json:"received_date"`
	FeedType     string      `json:"feed_type"`
	Sacks        float64     `json:"sacks"`
	PricePerSack float64     `json:"price_per_sack"`
	Notes        string      `json:"notes"`
}

func (s *FeedService) validate(input *FeedInput) error {
	if err := ValidateRecordDate(input.ReceivedDate, "tanggal penerimaan"); err != nil {
		return err
	}
	input.FeedType = strings.ToLower(strings.TrimSpace(input.FeedType))
	if input.FeedType == "" {
		input.FeedType = "layer"
	}
	if input.Sacks <= 0 {
		return apperr.BadRequest("jumlah pakan harus lebih besar dari 0")
	}
	if input.PricePerSack <= 0 {
		return apperr.BadRequest("harga pakan per sak harus lebih besar dari 0")
	}
	input.Notes = strings.TrimSpace(input.Notes)
	return nil
}

type FeedFilter struct {
	From     models.Date
	To       models.Date
	FeedType string
	Page     int
	Limit    int
}

func (s *FeedService) List(filter FeedFilter) ([]models.FeedReceipt, int64, error) {
	query := s.db.Model(&models.FeedReceipt{}).Where("received_date BETWEEN ? AND ?", filter.From, filter.To)
	if filter.FeedType != "" && filter.FeedType != "all" {
		query = query.Where("feed_type = ?", filter.FeedType)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var data []models.FeedReceipt
	if err := query.Order("received_date DESC, id DESC").
		Offset((filter.Page - 1) * filter.Limit).Limit(filter.Limit).
		Find(&data).Error; err != nil {
		return nil, 0, err
	}
	return data, total, nil
}

func (s *FeedService) Get(id uint) (*models.FeedReceipt, error) {
	var receipt models.FeedReceipt
	if err := s.db.First(&receipt, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, apperr.NotFound("penerimaan pakan tidak ditemukan")
		}
		return nil, err
	}
	return &receipt, nil
}

func (s *FeedService) latestPrice(tx *gorm.DB, feedType string) (*models.FeedPriceHistory, error) {
	var history models.FeedPriceHistory
	err := tx.Where("feed_type = ?", feedType).
		Order("effective_date DESC, id DESC").First(&history).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &history, nil
}

func (s *FeedService) recordPriceIfChanged(tx *gorm.DB, receipt *models.FeedReceipt, note string) error {
	latest, err := s.latestPrice(tx, receipt.FeedType)
	if err != nil {
		return err
	}
	if latest != nil && latest.PricePerSack == receipt.PricePerSack {
		return nil
	}
	return tx.Create(&models.FeedPriceHistory{
		FeedType:      receipt.FeedType,
		PricePerSack:  receipt.PricePerSack,
		EffectiveDate: receipt.ReceivedDate,
		FeedReceiptID: &receipt.ID,
		Notes:         note,
	}).Error
}

func (s *FeedService) Create(actor Actor, input FeedInput) (*models.FeedReceipt, error) {
	if err := s.validate(&input); err != nil {
		return nil, err
	}
	receipt := models.FeedReceipt{
		ReceivedDate: input.ReceivedDate, FeedType: input.FeedType,
		Sacks: input.Sacks, PricePerSack: input.PricePerSack, Notes: input.Notes,
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&receipt).Error; err != nil {
			return err
		}
		return s.recordPriceIfChanged(tx, &receipt, "Penerimaan pakan")
	})
	if err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "create", "feed_receipt", receipt.ID,
		"Penerimaan pakan "+formatFloat(receipt.Sacks)+" sak @ "+formatMoney(receipt.PricePerSack))
	return &receipt, nil
}

func (s *FeedService) Update(actor Actor, id uint, input FeedInput) (*models.FeedReceipt, error) {
	receipt, err := s.Get(id)
	if err != nil {
		return nil, err
	}
	if err := s.validate(&input); err != nil {
		return nil, err
	}
	oldPrice := receipt.PricePerSack
	receipt.ReceivedDate = input.ReceivedDate
	receipt.FeedType = input.FeedType
	receipt.Sacks = input.Sacks
	receipt.PricePerSack = input.PricePerSack
	receipt.Notes = input.Notes
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(receipt).Error; err != nil {
			return err
		}
		if oldPrice != receipt.PricePerSack {
			return s.recordPriceIfChanged(tx, receipt, "Perubahan harga pada penerimaan pakan")
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "update", "feed_receipt", id,
		"Mengubah penerimaan pakan tanggal "+receipt.ReceivedDate.String())
	return receipt, nil
}

func (s *FeedService) Delete(actor Actor, id uint) error {
	receipt, err := s.Get(id)
	if err != nil {
		return err
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.FeedPriceHistory{}).Where("feed_receipt_id = ?", id).
			Update("feed_receipt_id", nil).Error; err != nil {
			return err
		}
		return tx.Delete(&models.FeedReceipt{}, id).Error
	})
	if err != nil {
		return err
	}
	LogActivity(s.db, actor, "delete", "feed_receipt", id,
		"Menghapus penerimaan pakan tanggal "+receipt.ReceivedDate.String())
	return nil
}

type FeedPriceInput struct {
	FeedType      string      `json:"feed_type"`
	PricePerSack  float64     `json:"price_per_sack"`
	EffectiveDate models.Date `json:"effective_date"`
	Notes         string      `json:"notes"`
}

func (s *FeedService) AddPrice(actor Actor, input FeedPriceInput) (*models.FeedPriceHistory, error) {
	input.FeedType = strings.ToLower(strings.TrimSpace(input.FeedType))
	if input.FeedType == "" {
		input.FeedType = "layer"
	}
	if err := ValidateRecordDate(input.EffectiveDate, "tanggal berlaku harga"); err != nil {
		return nil, err
	}
	if input.PricePerSack <= 0 {
		return nil, apperr.BadRequest("harga pakan harus lebih besar dari 0")
	}
	latest, err := s.latestPrice(s.db, input.FeedType)
	if err != nil {
		return nil, err
	}
	if latest != nil && latest.PricePerSack == input.PricePerSack {
		return nil, apperr.Conflict("harga tersebut sama dengan harga terakhir yang tercatat")
	}
	if latest != nil && input.EffectiveDate.Before(latest.EffectiveDate) {
		return nil, apperr.BadRequest("tanggal berlaku tidak boleh sebelum riwayat harga terakhir")
	}
	history := models.FeedPriceHistory{
		FeedType: input.FeedType, PricePerSack: input.PricePerSack,
		EffectiveDate: input.EffectiveDate, Notes: strings.TrimSpace(input.Notes),
	}
	if err := s.db.Create(&history).Error; err != nil {
		return nil, err
	}
	LogActivity(s.db, actor, "create", "feed_price", history.ID,
		"Harga pakan "+history.FeedType+" menjadi "+formatMoney(history.PricePerSack))
	return &history, nil
}

func (s *FeedService) PriceHistory(feedType string, from, to models.Date) ([]models.FeedPriceHistory, error) {
	query := s.db.Where("effective_date BETWEEN ? AND ?", from, to)
	if feedType != "" && feedType != "all" {
		query = query.Where("feed_type = ?", feedType)
	}
	var data []models.FeedPriceHistory
	err := query.Order("effective_date ASC, id ASC").Find(&data).Error
	return data, err
}

func (s *FeedService) LatestPrice(feedType string) (*models.FeedPriceHistory, error) {
	if strings.TrimSpace(feedType) == "" {
		feedType = "layer"
	}
	return s.latestPrice(s.db, strings.ToLower(strings.TrimSpace(feedType)))
}

type FeedSummary struct {
	TotalSacks   float64 `json:"total_sacks"`
	TotalSpend   float64 `json:"total_spend"`
	Receipts     int     `json:"receipts"`
	AveragePrice float64 `json:"average_price"`
	LatestPrice  float64 `json:"latest_price"`
}

func (s *FeedService) Summary(from, to models.Date) (*FeedSummary, error) {
	var receipts []models.FeedReceipt
	if err := s.db.Where("received_date BETWEEN ? AND ?", from, to).Find(&receipts).Error; err != nil {
		return nil, err
	}
	summary := &FeedSummary{}
	priceWeight := 0.0
	for _, receipt := range receipts {
		summary.TotalSacks += receipt.Sacks
		summary.TotalSpend += receipt.TotalPrice()
		priceWeight += receipt.PricePerSack * receipt.Sacks
	}
	summary.Receipts = len(receipts)
	if summary.TotalSacks > 0 {
		summary.AveragePrice = priceWeight / summary.TotalSacks
	}
	latest, err := s.LatestPrice("layer")
	if err != nil {
		return nil, err
	}
	if latest != nil {
		summary.LatestPrice = latest.PricePerSack
	}
	return summary, nil
}
