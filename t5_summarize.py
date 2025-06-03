# t5_summarize.py
from transformers import T5ForConditionalGeneration, T5Tokenizer
import sys

def summarize(text):
    model_name = "t5-small"  # Use a pre-trained T5 model
    tokenizer = T5Tokenizer.from_pretrained(model_name, legacy=False)  # Set legacy=False
    model = T5ForConditionalGeneration.from_pretrained(model_name)

    input_text = "summarize: " + text
    inputs = tokenizer.encode(input_text, return_tensors="pt", max_length=512, truncation=True)
    summary_ids = model.generate(inputs, max_length=150, min_length=50, length_penalty=2.0, num_beams=4, early_stopping=True)
    summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
    return summary

if __name__ == "__main__":
    text = sys.argv[1]  # Get the text from command-line arguments
    summary = summarize(text)
    print(summary)