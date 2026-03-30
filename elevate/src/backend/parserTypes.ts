export interface BlockEvent {
    event: "start" | "end";
    type: string;
    line: number;
    indent: number;
    text: string;
}

export type ActiveBlock = Omit<BlockEvent, 'event'>;

export interface ParserError {
    message: string;
    line: number;
    column?: number;
}

export interface ParserOutput {
    fileVersion: number;
    activeBlock: ActiveBlock | null;
    nestingPath: ActiveBlock[];
    errors: ParserError[];
}
