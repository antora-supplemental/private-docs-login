// Small SDL reader for this issuer's config. Strings, numbers, booleans, blocks, // comments.

export function parseSdl(text) {
  const tokens = tokenize(String(text))
  const parsed = parseBlock(tokens, 0, false)
  if (parsed.next !== tokens.length) {
    throw new Error("Unexpected tokens after the config")
  }
  return parsed.value
}

function tokenize(text) {
  const tokens = []
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      i += 1
      continue
    }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i += 1
      continue
    }
    if (c === "{") {
      tokens.push({ t: "{" })
      i += 1
      continue
    }
    if (c === "}") {
      tokens.push({ t: "}" })
      i += 1
      continue
    }
    if (c === "\"") {
      let j = i + 1
      let s = ""
      while (j < text.length && text[j] !== "\"") {
        if (text[j] === "\\" && text[j + 1] === "\"") {
          s += "\""
          j += 2
          continue
        }
        s += text[j]
        j += 1
      }
      if (text[j] !== "\"") throw new Error("Unclosed string in config")
      tokens.push({ t: "str", v: s })
      i = j + 1
      continue
    }
    if (c === "-" || (c >= "0" && c <= "9")) {
      let j = i + 1
      while (j < text.length && text[j] >= "0" && text[j] <= "9") j += 1
      tokens.push({ t: "num", v: Number(text.slice(i, j)) })
      i = j
      continue
    }
    if ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_") {
      let j = i + 1
      while (j < text.length && /[A-Za-z0-9_-]/.test(text[j])) j += 1
      const word = text.slice(i, j)
      if (word === "true" || word === "false") tokens.push({ t: "bool", v: word === "true" })
      else tokens.push({ t: "id", v: word })
      i = j
      continue
    }
    throw new Error(`Unexpected character in config at ${i}`)
  }
  return tokens
}

function parseBlock(tokens, i, braced) {
  const obj = {}
  function add(key, value) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (!Array.isArray(obj[key])) obj[key] = [obj[key]]
      obj[key].push(value)
    } else {
      obj[key] = value
    }
  }
  while (i < tokens.length) {
    const tok = tokens[i]
    if (tok.t === "}") {
      if (!braced) throw new Error("Extra } in config")
      return { value: obj, next: i + 1 }
    }
    if (tok.t !== "id") throw new Error("Expected a config key")
    const next = tokens[i + 1]
    if (!next) throw new Error(`Missing value for ${tok.v}`)
    if (next.t === "{") {
      const inner = parseBlock(tokens, i + 2, true)
      add(tok.v, inner.value)
      i = inner.next
      continue
    }
    if (next.t === "str" || next.t === "num" || next.t === "bool") {
      add(tok.v, next.v)
      i += 2
      continue
    }
    throw new Error(`Bad value for ${tok.v}`)
  }
  if (braced) throw new Error("Unclosed block in config")
  return { value: obj, next: i }
}

export function asList(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}
