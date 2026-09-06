type Outcome = 'failure' | 'success' | 'unknown';

export function classifyOutcome(code: number) {
    const outcomes = new Map<number, Outcome>([
        [503, 'failure'],
        [504, 'failure'],
        [500, 'unknown'],
    ]);

    const outcome = outcomes.get(code);

    return outcome ? outcome : 'success';
}
