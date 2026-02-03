declare var Diff: {
    diffLines(oldText: string, newText: string): Array<{
        value: string;
        added?: boolean;
        removed?: boolean;
    }>;
};
