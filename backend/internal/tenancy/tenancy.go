// Package tenancy mengimplementasikan isolasi data per kandang (tenant).
//
// Caranya: setiap request membuat DB session yang membawa tenant_id di context,
// lalu callback GORM menambahkan filter tenant_id pada query/update/delete dan
// mengisi tenant_id otomatis saat create. Dengan begitu service yang sudah ada
// tidak perlu menambahkan kondisi tenant satu per satu.
package tenancy

import (
	"context"
	"reflect"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type contextKey struct{}

var scopedType = reflect.TypeOf((*interface{ IsTenantScoped() })(nil)).Elem()

// ContextWithTenant menyimpan id kandang di context.
func ContextWithTenant(ctx context.Context, tenantID uint) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	return context.WithValue(ctx, contextKey{}, tenantID)
}

// TenantIDFromContext mengambil id kandang dari context.
func TenantIDFromContext(ctx context.Context) (uint, bool) {
	if ctx == nil {
		return 0, false
	}
	id, ok := ctx.Value(contextKey{}).(uint)
	if !ok || id == 0 {
		return 0, false
	}
	return id, true
}

// WithTenant mengembalikan session DB yang terikat ke satu tenant. Session ini
// aman dipakai berulang karena tenant disimpan di context, bukan di Statement.
func WithTenant(db *gorm.DB, ctx context.Context, tenantID uint) *gorm.DB {
	return db.WithContext(ContextWithTenant(ctx, tenantID))
}

// TenantID mengambil tenant yang sedang aktif pada session DB.
func TenantID(db *gorm.DB) (uint, bool) {
	if db == nil || db.Statement == nil {
		return 0, false
	}
	return TenantIDFromContext(db.Statement.Context)
}

// Register memasang callback tenant pada GORM.
func Register(db *gorm.DB) error {
	steps := []struct {
		processor interface{ Register(string, func(*gorm.DB)) error }
		name      string
		fn        func(*gorm.DB)
	}{
		{db.Callback().Query().Before("gorm:query"), "tenancy:query", scopeRead},
		{db.Callback().Update().Before("gorm:update"), "tenancy:update", scopeRead},
		{db.Callback().Delete().Before("gorm:delete"), "tenancy:delete", scopeRead},
		{db.Callback().Create().Before("gorm:create"), "tenancy:create", scopeCreate},
	}
	for _, step := range steps {
		if err := step.processor.Register(step.name, step.fn); err != nil {
			return err
		}
	}
	return nil
}

func scopeRead(db *gorm.DB) {
	tenantID, ok := TenantID(db)
	if !ok || !isScoped(db.Statement) {
		return
	}
	table := db.Statement.Table
	if table == "" && db.Statement.Schema != nil {
		table = db.Statement.Schema.Table
	}
	column := clause.Column{Name: "tenant_id"}
	if table != "" {
		column.Table = table
	}
	db.Statement.AddClause(clause.Where{Exprs: []clause.Expression{
		clause.Eq{Column: column, Value: tenantID},
	}})
}

func scopeCreate(db *gorm.DB) {
	tenantID, ok := TenantID(db)
	if !ok || !isScoped(db.Statement) {
		return
	}
	field := db.Statement.Schema.LookUpField("TenantID")
	if field == nil || field.Set == nil {
		return
	}
	value := reflect.ValueOf(db.Statement.Dest)
	for value.Kind() == reflect.Ptr {
		if value.IsNil() {
			return
		}
		value = value.Elem()
	}
	switch value.Kind() {
	case reflect.Slice, reflect.Array:
		for i := 0; i < value.Len(); i++ {
			_ = field.Set(db.Statement.Context, value.Index(i), tenantID)
		}
	case reflect.Struct:
		_ = field.Set(db.Statement.Context, value, tenantID)
	}
}

func isScoped(stmt *gorm.Statement) bool {
	if stmt == nil || stmt.Schema == nil {
		return false
	}
	modelType := stmt.Schema.ModelType
	return modelType.Implements(scopedType) || reflect.PointerTo(modelType).Implements(scopedType)
}
