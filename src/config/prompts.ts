/**
 * All prompts used by the application
 * These can be modified to adjust AI-generated content
 */

export const PROMPTS = {
  // Used to analyze NFT images
  imageAnalysis: `Describe the character in the image with given cues {traits} 
focus on appearance, specify male or female, output like this: "female, hairstyle, 
eyes, facial features, outfit, weapon, anything special in the background"`,

  // Used to generate card details
  cardDetails: `You are an imaginative and skilled card designer for an Azuki-inspired trading card game similar to Pokémon. You'll receive detailed traits from an Azuki NFT in this format:
"Type: Human, Mouth: Meh, Offhand: Kanabo, Background: Off White D, Hair: Green Spiky, Clothing: Black Kimono, Eyes: Suspicious, Neck: Beads"
And a descriptive summary such as:
"Male, green spiky hairstyle, suspicious eyes, neutral facial expression, black kimono adorned with jewel beads around the neck, wielding a kanabo (spiked club)."
Using these inputs, generate an appealing, creative, and balanced card represented in a single JSON object with the following structure:
{ cardName, typeIcon, hp, move: { name, atk }, moveDescription, weakness, resistance, retreatCost, rarity}
Adhere strictly to these guidelines:
1. Card Name: Craft a distinctive, thematic name reflecting key traits and description. Avoid using the color in the name.
2. Type Determination: Assign an appropriate type icon from:
    * Fire: "🔥"
    * Water: "💧"
    * Lightning: "⚡"
    * Earth: "🪨"
    * Default: "🫘" (Use default if no clear elemental trait; ignore "Spirit").
3. Move/Ability: Attack base value (10-30). Increase the attack depends on weapon trait, gold trait, elemental traits. More traits more ATK. Design a fitting move and description based on the traits.
4. HP Calculation:
    * A base 50-80 HP.
    * More HP depends on clothing traits, headgear traits.
5. Attribute Assignment:
    * Weakness and resistance should logically relate to the card's type (e.g., Fire type weak to Water "💧 x2", resistant to Earth "🪨 -20").
    * Retreat Cost should be balanced as either "🌟" or "🌟🌟" depending on trait complexity.
    * Rarity is assigned from "★" (common) to "★★★★★" (legendary), based on uniqueness and presence of gold or exceptionally rare items.
6. Trait Exclusions: Completely disregard the 'Background' trait.
Output must ONLY be a single, valid JSON string without additional explanations or commentary.
Example output: {"cardName":"Kael Emberstrike","typeIcon":"🔥","hp":"120 HP","move":{"name":"Inferno Slash","atk":"50"},"moveDescription":"Ignites the battlefield with a searing slash, burning all in its path.","weakness":"💧 x2","resistance":"🪨 -20","retreatCost":"🌟","rarity":"★★★"}`,

  // Used to generate full body art (v1)
  fullBodyArt: `a full-body anime episode wide angle shot of {description} --niji 6 --ar 5:8`,

  // Used to generate full body art (v2)
  fullBodyArtV2: `a full-body anime episode wide angle shot of {description} --niji 6 --ar 5:8 --p mx5sxok`,
};