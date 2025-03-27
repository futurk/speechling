export interface Sentence {
    id: number;
    text: string;
    lang: string;
    audios: Array<{ id: number, author: string, attribution_url: string }>;
    translations: Array<Array<Sentence>>;
}