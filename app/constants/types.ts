export interface Sentence {
    id: number;
    text: string;
    lang: string;
    audios?: Array<{ id: number }>;
    translations?: Array<Array<Sentence>>;
}