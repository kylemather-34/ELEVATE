export interface BlockEvent {
    event: "start" | "end";
    type: string;
    line: number;
    indent: number;
    text: string;
}

export interface ActiveBlock {
    type: string;
    line: number;
    indent: number;
    text: string;
}

export interface ParserError {
    message: string;
    line: number;
    column?: number;
}

export interface ParserOutput {
    fileVersion: number;
    activelock: ActiveBlock | null;
    nestingPath: ActiveBlock[];
    errors: ParserError[];
}