export interface ConceptInput {
  concept: string;
  context_industry?: string;
  context_platform?: string;
}

export function buildConceptPrompt(input: ConceptInput): string {
  return `Explain "${input.concept}" the way a senior media buyer explains it over coffee to a smart friend who doesn't work in ads.

Industry context: ${input.context_industry || "(general)"}
Platform context: ${input.context_platform || "(any)"}

STRUCTURE (markdown):

# {Concept name}

**In 30 seconds:** {Plain-English explanation, ≤ 50 words.}

## Why your money cares
{Concrete money impact, in plain terms — example: "A higher Quality Score lowers what you pay per click for the same position, so the same budget buys more clicks." Only quote a percentage if you can name its source; otherwise describe the direction.}

## How to improve it
{3 specific, named actions. Each starts with a verb. No "consider" or "try" — say it.}

## Industry benchmarks
{If applicable: typical ranges by industry / platform. Cite a year. Say "directional" if uncertain.}

## Common mistakes
{2-3 specific traps. Name the trap and the cost.}

## Mental model
{One sentence — what to remember when nothing else sticks.}

CONSTRAINTS:
- No jargon without unpacking it inline (good: "Quality Score (Google's 1-10 rating of your ad-keyword-landing-page combo)").
- Use numbers wherever possible.
- ≤ 350 words total.
- No emoji. No "in conclusion."`;
}
