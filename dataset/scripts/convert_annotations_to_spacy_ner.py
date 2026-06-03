import os
import json
import random
from pathlib import Path
import spacy
from spacy.tokens import DocBin
from spacy.util import filter_spans

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
EXPORTED_DIR = BASE_DIR / "dataset" / "ml_training" / "exported"
NER_DATA_DIR = BASE_DIR / "dataset" / "ml_training" / "entity_extraction"

def convert():
    nlp = spacy.blank("en")
    files = list(EXPORTED_DIR.glob("*.json"))
    
    if not files:
        print("No annotation files found in exported/ directory.")
        return

    train_data = []
    skipped_spans = 0
    total_docs = 0

    for f in files:
        try:
            with open(f, "r") as jf:
                item = json.load(jf)
            
            text = item.get("text_noisy", item.get("text_clean"))
            if not text: continue
            
            entities = []
            if "tests" in item:
                for test in item["tests"]:
                    name = test.get("test_name")
                    val = str(test.get("value"))
                    
                    if not name or not val: continue

                    # Find span for TEST_NAME
                    start = text.find(name)
                    if start != -1:
                        entities.append((start, start + len(name), "TEST_NAME"))
                    
                    # Find span for VALUE (starting search from name position to minimize random overlaps)
                    v_start = text.find(val, start if start != -1 else 0)
                    if v_start != -1:
                        entities.append((v_start, v_start + len(val), "VALUE"))

            train_data.append((text, {"entities": entities}))
            total_docs += 1
        except Exception as e:
            print(f"Skipping file {f.name} due to error: {e}")

    # Partition
    random.shuffle(train_data)
    split = int(len(train_data) * 0.8)
    train_set = train_data[:split]
    dev_set = train_data[split:]

    for name, subset in [("train", train_set), ("dev", dev_set)]:
        db = DocBin()
        for text, annot in subset:
            doc = nlp.make_doc(text)
            ents = []
            for start, end, label in annot["entities"]:
                # Validation: skip spans with start >= end or outside boundaries
                if start >= end or start < 0 or end > len(text):
                    skipped_spans += 1
                    continue
                
                span = doc.char_span(start, end, label=label, alignment_mode="contract")
                if span is not None:
                    ents.append(span)
                else:
                    skipped_spans += 1
            
            # Fix overlap issue: filter_spans prefers longer spans and removes overlaps
            filtered = filter_spans(ents)
            if len(filtered) < len(ents):
                skipped_spans += (len(ents) - len(filtered))
            
            try:
                doc.ents = filtered
                db.add(doc)
            except Exception as e:
                # Last resort catch for E1010 or similar
                print(f"Error adding doc to DocBin: {e}")
                
        output_path = NER_DATA_DIR / f"{name}.spacy"
        NER_DATA_DIR.mkdir(parents=True, exist_ok=True)
        db.to_disk(output_path)
        print(f"Successfully created {output_path} with {len(subset)} samples.")

    print("\nConversion Summary:")
    print(f"- Total Docs Converted: {total_docs}")
    print(f"- Total Spans Skipped (Overlapping/Invalid): {skipped_spans}")

if __name__ == "__main__":
    convert()
