import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { PureJsTokenizer } from './pure-js-tokenizer.ts';
import { BertTokenizer } from '@huggingface/transformers';
import * as path from 'path';

describe('PureJsTokenizer', async () => {
    const tokenizerPath = path.resolve(import.meta.dirname, '../models/all-MiniLM-L6-v2');
    const tokenizerJsonPath = path.resolve(tokenizerPath, 'tokenizer.json');
    
    const pureTokenizer = PureJsTokenizer.loadFromFile(tokenizerJsonPath);
    const hfTokenizer = await BertTokenizer.from_pretrained(tokenizerPath, { local_files_only: true });

    const testStrings = [
        "Hello, world!",
        "This is a test of the pure JavaScript tokenizer.",
        "Transformers are awesome!",
        "all-MiniLM-L6-v2 is a great model.",
        "HuggingFace tokenizers are fast.",
        "Let's see how it handles punctuation: hello!!! world???",
        "Numbers: 123 456 789",
        "Accents: Café, résumé",
        "Long words: antidisestablishmentarianism",
        "Empty string: ",
        "Whitespace:     "
    ];

    for (const str of testStrings) {
        it(`should match Transformers.js for string: "${str}"`, async () => {
            const pureResult = pureTokenizer.encode(str);
            const hfResult = await hfTokenizer(str, { padding: 'max_length', truncation: true, maxLength: 128 });

            const hfInputIds = Array.from(hfResult.input_ids.data).map((x: any) => Number(x));
            const hfAttentionMask = Array.from(hfResult.attention_mask.data).map((x: any) => Number(x));
            const pureSepIndex = pureResult.input_ids.indexOf(102);
            const hfSepIndex = hfInputIds.indexOf(102);

            const pureSlice = pureResult.input_ids.slice(0, pureSepIndex + 1);
            const hfSlice = hfInputIds.slice(0, hfSepIndex + 1);

            assert.deepStrictEqual(pureSlice, hfSlice, `input_ids mismatch for "${str}"`);
        });
    }
});
