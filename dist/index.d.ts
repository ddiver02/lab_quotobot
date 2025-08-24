import 'dotenv/config';
import { z } from 'genkit';
export declare const quoteMatchFlow: import("genkit").Action<z.ZodString, z.ZodObject<{
    input: z.ZodString;
    chosenIndex: z.ZodNumber;
    reason: z.ZodString;
    quote: z.ZodObject<{
        author: z.ZodString;
        source: z.ZodString;
        quote: z.ZodString;
        emotion: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        quote: string;
        author: string;
        source: string;
        emotion: string[];
    }, {
        quote: string;
        author: string;
        source: string;
        emotion: string[];
    }>;
}, "strip", z.ZodTypeAny, {
    input: string;
    chosenIndex: number;
    reason: string;
    quote: {
        quote: string;
        author: string;
        source: string;
        emotion: string[];
    };
}, {
    input: string;
    chosenIndex: number;
    reason: string;
    quote: {
        quote: string;
        author: string;
        source: string;
        emotion: string[];
    };
}>, z.ZodTypeAny>;
//# sourceMappingURL=index.d.ts.map