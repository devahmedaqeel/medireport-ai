import pytest
import sys
from pathlib import Path

# Add backend to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from services.line_table_extraction_service import parse_line_as_test_row
from services.parser_service import build_alias_lookup

@pytest.fixture
def aliases():
    return build_alias_lookup()

def test_troponin_range_masking(aliases):
    line = "Troponin I 0.09 ng/mL Ref: 0-0.04"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Troponin I"
    assert res["value"] == 0.09
    assert res["unit"] == "ng/mL"
    assert res["range_low"] == 0.0
    assert res["range_high"] == 0.04

def test_troponin_ocr_masking(aliases):
    line = "Troponin I 0.09 ng/mL Ref: O-0.04"
    res = parse_line_as_test_row(line, aliases)
    assert res["value"] == 0.09
    assert res["range_low"] == 0.0

def test_glucose_fasting(aliases):
    line = "Glucose Fasting 110 mg/dL 70-100"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Fasting Blood Sugar"
    assert res["value"] == 110.0
    assert res["range_low"] == 70.0
    assert res["range_high"] == 100.0

def test_cholesterol_lipid(aliases):
    line = "Cholesterol 190 mg/dL 100-200"
    res = parse_line_as_test_row(line, aliases)
    assert res["value"] == 190.0
    assert res["range_low"] == 100.0

def test_ldl_lipid(aliases):
    line = "LDL 110 mg/dL 0-100"
    res = parse_line_as_test_row(line, aliases)
    assert res["value"] == 110.0
    assert res["range_high"] == 100.0

def test_hba1c_extraction(aliases):
    line = "HbA1c 6.2 % 4.0-5.6"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "HbA1c"
    assert res["value"] == 6.2
    assert res["range_low"] == 4.0
    assert res["range_high"] == 5.6

def test_ckmb_extraction(aliases):
    line = "CK-MB 100.55 ng/mL 0-25"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "CK-MB"
    assert res["value"] == 100.55

def test_bnp_extraction(aliases):
    line = "BNP 21.72 pg/mL 0-100"
    res = parse_line_as_test_row(line, aliases)
    assert res["value"] == 21.72
    assert res["range_high"] == 100.0

def test_ldh_extraction(aliases):
    line = "LDH 8.21 U/L 0-250"
    res = parse_line_as_test_row(line, aliases)
    assert res["value"] == 8.21

def test_ocr_h6_normalization(aliases):
    line = "H6 14.2 g/dL 13-17"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Hemoglobin"
    assert res["value"] == 14.2

def test_w8c_ocr_typo(aliases):
    line = "W8C 14000 /cumm 4000-11000"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "White Blood Cells"
    assert res["value"] == 14000
    assert res["unit"] == "/cmm"

def test_urine_protein_qual(aliases):
    line = "Urine Protein Negative"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Urine Protein"
    assert res["range_type"] == "qualitative"
    assert res["range_text"] == "Negative"

def test_urine_glucose_qual(aliases):
    line = "Urine Glucose Nil"
    res = parse_line_as_test_row(line, aliases)
    assert res["range_text"] == "Nil"

def test_vldl_lipid(aliases):
    line = "VLDL 20 mg/dL 2-30"
    res = parse_line_as_test_row(line, aliases)
    assert res["value"] == 20.0
    assert res["range_low"] == 2.0

def test_triglycerides_lipid(aliases):
    line = "Triglycerides 140 mg/dL 0-150"
    res = parse_line_as_test_row(line, aliases)
    assert res["value"] == 140.0
    assert res["range_high"] == 150.0

def test_giucose_ocr_typo(aliases):
    line = "GIucose Fasting 110 mg/dL 70-100"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Fasting Blood Sugar"
    assert res["value"] == 110.0

def test_neutrophils_ocr_typo(aliases):
    line = "NeutrophiIs 60 % 40-75"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Neutrophils"
    assert res["value"] == 60.0

def test_bilirubin_direct_extraction(aliases):
    line = "BiIirubin Direct 22.76  O - 0"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Bilirubin Direct"
    assert res["value"] == 22.76
    assert res["range_low"] == 0.0
    assert res["range_high"] == 0.0

def test_bun_extraction(aliases):
    line = "BUN                    35.67                 0-0"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "BUN"
    assert res["value"] == 35.67
    assert res["range_low"] == 0.0
    assert res["range_high"] == 0.0

def test_egfr_extraction(aliases):
    line = "eGFR                   71.59                 O-O"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "eGFR"
    assert res["value"] == 71.59
    assert res["range_low"] == 0.0
    assert res["range_high"] == 0.0

def test_potassium_extraction(aliases):
    line = "Potassium              82.04                 0-O"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Potassium"
    assert res["value"] == 82.04
    assert res["range_low"] == 0.0
    assert res["range_high"] == 0.0

def test_chloride_ocr_typo(aliases):
    line = "ChI0ride               12.78                 O-0"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Chloride"
    assert res["value"] == 12.78
    assert res["range_low"] == 0.0
    assert res["range_high"] == 0.0

def test_free_t4_extraction(aliases):
    line = "Free T4: 39.75  [Ref: O-O]"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Free T4"
    assert res["value"] == 39.75
    assert res["range_low"] == 0.0
    assert res["range_high"] == 0.0

def test_ph_extraction(aliases):
    line = "pH 31.48  0 - O"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "pH"
    assert res["value"] == 31.48
    assert res["range_low"] == 0.0
    assert res["range_high"] == 0.0

def test_pus_cells_extraction(aliases):
    line = "Pus Cells: 3.3  [Ref: 0-0]"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Pus Cells"
    assert res["value"] == 3.3
    assert res["range_low"] == 0.0
    assert res["range_high"] == 0.0

def test_red_blood_cells_ocr_typo(aliases):
    line = "Red Bl00d CeIls 37.33  0 - 0"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Red Blood Cells"
    assert res["value"] == 37.33
    assert res["range_low"] == 0.0
    assert res["range_high"] == 0.0

def test_total_cholesterol_ocr_typo(aliases):
    line = "Total ChoIesterol 55.43  0 - 0"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Cholesterol"
    assert res["value"] == 55.43
    assert res["range_low"] == 0.0
    assert res["range_high"] == 0.0

def test_white_blood_cells_ocr_typo(aliases):
    line = "T0taI Leuk0cyte Count 22641.57 /cmm 40O0 - 1I000"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "White Blood Cells"
    assert res["value"] == 22641.57
    assert res["unit"] == "/cmm"
    assert res["range_low"] == 4000.0
    assert res["range_high"] == 11000.0

def test_triglycerides_ocr_typo(aliases):
    line = "TrigIycerides 13.78  O - O"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Triglycerides"
    assert res["value"] == 13.78
    assert res["range_low"] == 0.0
    assert res["range_high"] == 0.0

def test_alt_ocr_typo(aliases):
    line = "Alanine Amin0transferase 215.99     U/L        7-56"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "ALT"
    assert res["value"] == 215.99
    assert res["unit"] == "U/L"
    assert res["range_low"] == 7.0
    assert res["range_high"] == 56.0

def test_hemoglobin_ocr_typo(aliases):
    line = "Haemogl0bin: 4.39 g/dL [Ref: I2 O-I7.0]"
    res = parse_line_as_test_row(line, aliases)
    assert res["test_name"] == "Hemoglobin"
    assert res["value"] == 4.39
    assert res["unit"] == "g/dL"
    assert res["range_low"] == 12.0
    assert res["range_high"] == 17.0
