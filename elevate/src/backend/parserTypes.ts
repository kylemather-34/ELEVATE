export interface BlockEvent {
    event: "start" | "end";
    type: string;
    line: number;
    indent: number;
    text: string;
}
