package models

// AgeProductivityPoint adalah titik acuan produktivitas (hen-day, %) menurut
// umur puyuh dalam hari. Puyuh mulai bertelur sekitar umur 40 hari, mencapai
// puncak pada 10-12 minggu, lalu produksi menurun perlahan seiring bertambahnya
// umur. Kurva ini dipakai untuk membandingkan produksi aktual dengan standar
// umur, bukan untuk menggantikan pencatatan produksi harian.
type ageProductivityPoint struct {
	Day  int
	Rate float64
}

var ageProductivityCurve = []ageProductivityPoint{
	{0, 0}, {35, 0}, {40, 35}, {49, 65}, {56, 80}, {70, 88}, {84, 88},
	{98, 84}, {112, 80}, {126, 76}, {140, 72}, {168, 66}, {196, 60},
	{224, 54}, {252, 48}, {280, 42}, {300, 36}, {365, 28},
}

// AgeProductivityStandard mengembalikan standar produktivitas telur (% dari
// populasi per hari) untuk umur tertentu. Nilai diinterpolasi linear di antara
// titik acuan dan dibatasi pada 0-100%.
func AgeProductivityStandard(ageDays int) float64 {
	if ageDays <= 0 {
		return 0
	}
	if ageDays >= ageProductivityCurve[len(ageProductivityCurve)-1].Day {
		return ageProductivityCurve[len(ageProductivityCurve)-1].Rate
	}
	for i := 1; i < len(ageProductivityCurve); i++ {
		right := ageProductivityCurve[i]
		if ageDays > right.Day {
			continue
		}
		left := ageProductivityCurve[i-1]
		if right.Day == left.Day {
			return right.Rate
		}
		ratio := float64(ageDays-left.Day) / float64(right.Day-left.Day)
		rate := left.Rate + (right.Rate-left.Rate)*ratio
		return roundRate(rate)
	}
	return 0
}

// AgeProductivityStage memberi label fase produksi berdasarkan umur.
func AgeProductivityStage(ageDays int) string {
	switch {
	case ageDays < 40:
		return "belum bertelur"
	case ageDays < 56:
		return "awal produksi"
	case ageDays < 90:
		return "puncak produksi"
	case ageDays < 140:
		return "produksi menurun"
	default:
		return "produksi tua"
	}
}

func roundRate(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 100 {
		return 100
	}
	return float64(int(value*100+0.5)) / 100
}
