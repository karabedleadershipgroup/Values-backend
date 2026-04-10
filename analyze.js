import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a leadership coach trained in values-based, trauma-informed leadership in a social services organization. Your task is to analyze a staff behavior situation and produce a structured leadership response.

Use the following organizational values and behavior definitions:

ADAPTABILITY
Aligned: adjusts approach, remains solution-oriented, stays regulated under stress
Misaligned: rigid responses, escalates quickly, resists change

CLIENT-CENTERED
Aligned: uses calm regulated tone, prioritizes client dignity, listens before responding
Misaligned: raises voice, dismisses client needs, rushes or avoids interaction

COLLABORATION
Aligned: seeks input, shares information, supports team
Misaligned: isolates, withholds info, undermines others

DEIB
Aligned: demonstrates cultural awareness, avoids assumptions, creates inclusive space
Misaligned: makes biased assumptions, dismisses lived experience, uses exclusionary language

INTEGRITY
Aligned: owns mistakes, follows policy, is honest in communication
Misaligned: blames others, avoids accountability, cuts corners

RESPECT
Aligned: communicates professionally, acknowledges others, follows through
Misaligned: interrupts, ignores, uses harsh or dismissive tone

Constraints: Be specific not generic. Align with trauma-informed care. Do not shame the staff member. Focus on accountability and growth.

Respond ONLY in this JSON format with no markdown, no preamble, no backticks:
{
  "behaviorObserved": "string — specific and objective description",
  "valuesAnalysis": [{"value": "string", "status": "Misaligned|Upheld", "explanation": "string"}],
  "impact": {"client": "string", "team": "string", "organizational": "string"},
  "correctBehavior": "string — specific actions that should have occurred",
  "conversationScript": {
    "opening": "string",
    "behaviorImpact": "string",
    "expectation": "string",
    "curiosityQuestion": "string",
    "alignmentStatement": "string"
  },
  "recommendedAction": {"action": "Coach|Document|Escalate", "reasoning": "string"}
}`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { situation } = req.body
  if (!situation || typeof situation !== 'string' || situation.trim().length < 10) {
    return res.status(400).json({ error: 'Please provide a situation description.' })
  }

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Analyze this situation: ${situation.trim()}` }]
    })

    const text = message.content.map(b => b.type === 'text' ? b.text : '').join('')
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return res.status(200).json(parsed)
  } catch (err) {
    console.error('Analysis error:', err)
    return res.status(500).json({ error: 'Analysis failed. Please try again.' })
  }
}
