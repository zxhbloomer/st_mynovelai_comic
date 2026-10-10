function findCharacterByName(name, characters) {
    const key = String(name || '').trim().toLowerCase();
    return characters.find(character => String(character?.name || '').trim().toLowerCase() === key);
}

function findEnabledCharacterByName(name, characters) {
    return findCharacterByName(name, characters.filter(character => character?.enabled !== false));
}

export function resolveAutoLearnCharacter(candidate, characters = []) {
    const name = candidate.name;
    const enabledCharacter = findEnabledCharacterByName(name, characters);
    if (enabledCharacter) {
        return { action: 'update', character: enabledCharacter };
    }
    if (findCharacterByName(name, characters)) {
        return { action: 'skip', character: null };
    }
    // Drawing may omit a type; creating a library entry must not invent one.
    if (!candidate.type) return { action: 'skip', character: null };
    return { action: 'create', character: null };
}

