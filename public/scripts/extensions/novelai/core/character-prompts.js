export function joinTags(...values) { return values.map(value => String(value || '').trim()).filter(Boolean).join(', '); }
export function assembleCharacterPrompts(chars = [], knownCharacters = []) {
    return chars.filter(Boolean).map(character => ({ prompt: String(character.prompt || character.tags || character.name || ''), uc: String(character.uc || ''), center: character.center || { x: 0.5, y: 0.5 } }));
}
