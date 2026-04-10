import * as fs from 'fs';
import * as path from 'path';

const PUNCTUATION_REGEX = '\\p{P}\\u0021-\\u002F\\u003A-\\u0040\\u005B-\\u0060\\u007B-\\u007E';
const BERT_PATTERN = new RegExp(`[^\\s${PUNCTUATION_REGEX}]+|[${PUNCTUATION_REGEX}]`, 'gu');

export class PureJsTokenizer {
    private vocab: Map<string, number>;
    private unkToken: string = '[UNK]';
    private unkTokenId: number;
    private clsTokenId: number;
    private sepTokenId: number;
    private maxInputCharsPerWord: number = 100;
    private continuingSubwordPrefix: string = '##';
    private maxLength: number = 128;

    constructor(vocab: Record<string, number>) {
        this.vocab = new Map(Object.entries(vocab));
        this.unkTokenId = this.vocab.get(this.unkToken) ?? 100;
        this.clsTokenId = this.vocab.get('[CLS]') ?? 101;
        this.sepTokenId = this.vocab.get('[SEP]') ?? 102;
    }

    static loadFromFile(filePath: string): PureJsTokenizer {
        const content = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(content);
        return new PureJsTokenizer(json.model.vocab);
    }

    tokenize(text: string): string[] {
        // Lowercase and strip accents as per BertUncased default behavior
        const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        const words = normalized.trim().match(BERT_PATTERN) || [];
        
        const outputTokens: string[] = [];
        for (const word of words) {
            const chars = [...word];
            if (chars.length > this.maxInputCharsPerWord) {
                outputTokens.push(this.unkToken);
                continue;
            }

            let isUnknown = false;
            let start = 0;
            const subTokens: string[] = [];

            while (start < chars.length) {
                let end = chars.length;
                let currentSubstring: string | null = null;
                while (start < end) {
                    let substr = chars.slice(start, end).join('');
                    if (start > 0) {
                        substr = this.continuingSubwordPrefix + substr;
                    }
                    if (this.vocab.has(substr)) {
                        currentSubstring = substr;
                        break;
                    }
                    --end;
                }
                if (currentSubstring === null) {
                    isUnknown = true;
                    break;
                }
                subTokens.push(currentSubstring);
                start = end;
            }
            if (isUnknown) {
                outputTokens.push(this.unkToken);
            } else {
                outputTokens.push(...subTokens);
            }
        }
        return outputTokens;
    }

    encode(text: string): { input_ids: number[], attention_mask: number[], token_type_ids: number[] } {
        const tokens = this.tokenize(text);
        let ids = tokens.map(t => this.vocab.get(t) ?? this.unkTokenId);
        
        // Add special tokens
        ids = [this.clsTokenId, ...ids, this.sepTokenId];
        
        // Truncate if needed
        if (ids.length > this.maxLength) {
            ids = ids.slice(0, this.maxLength);
        }
        
        const attention_mask = new Array(ids.length).fill(1);
        const token_type_ids = new Array(ids.length).fill(0);
        
        // Pad if needed
        while (ids.length < this.maxLength) {
            ids.push(0); // 0 is [PAD]
            attention_mask.push(0);
            token_type_ids.push(0);
        }
        
        return {
            input_ids: ids,
            attention_mask: attention_mask,
            token_type_ids: token_type_ids
        };
    }
}
