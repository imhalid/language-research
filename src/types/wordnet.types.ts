// To parse this data:
//
//   import { Convert, WordnetTypes } from "./file";
//
//   const wordnetTypes = Convert.toWordnetTypes(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface WordnetTypes {
    synset:      { [key: string]: Synset };
    lemma:       { [key: string]: string[] };
    lemmaRanked: { [key: string]: string[] };
    exception:   { [key: string]: string[] };
    example:     { [key: string]: string };
}

export interface Synset {
    offset:  string;
    pos:     Pos;
    word:    string[];
    pointer: Pointer[];
    frame:   Frame[] | null;
    gloss:   string;
    example: Example[] | null;
}

export interface Example {
    wordNumber:     number;
    templateNumber: number;
}

export interface Frame {
    wordNumber:  number;
    frameNumber: number;
}

export interface Pointer {
    symbol: Symbol;
    synset: string;
    source: number;
    target: number;
}

export enum Symbol {
    Ambitious = "*",
    C = ";c",
    Cunning = "$",
    Empty = "=",
    Fluffy = "&",
    Hilarious = "@",
    I = "~i",
    Indecent = "~",
    Indigo = "<",
    M = "#m",
    Magenta = ">",
    P = "%p",
    Purple = "!",
    R = ";r",
    S = "%s",
    Sticky = "\\",
    Symbol = "+",
    SymbolC = "-c",
    SymbolI = "@i",
    SymbolM = "%m",
    SymbolP = "#p",
    SymbolR = "-r",
    SymbolS = "#s",
    SymbolU = "-u",
    Tentacled = "^",
    U = ";u",
}

export enum Pos {
    A = "a",
    N = "n",
    R = "r",
    S = "s",
    V = "v",
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toWordnetTypes(json: string): WordnetTypes {
        return cast(JSON.parse(json), r("WordnetTypes"));
    }

    public static wordnetTypesToJson(value: WordnetTypes): string {
        return JSON.stringify(uncast(value, r("WordnetTypes")), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref: any = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
    return { literal: typ };
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "WordnetTypes": o([
        { json: "synset", js: "synset", typ: m(r("Synset")) },
        { json: "lemma", js: "lemma", typ: m(a("")) },
        { json: "lemmaRanked", js: "lemmaRanked", typ: m(a("")) },
        { json: "exception", js: "exception", typ: m(a("")) },
        { json: "example", js: "example", typ: m("") },
    ], false),
    "Synset": o([
        { json: "offset", js: "offset", typ: "" },
        { json: "pos", js: "pos", typ: r("Pos") },
        { json: "word", js: "word", typ: a("") },
        { json: "pointer", js: "pointer", typ: a(r("Pointer")) },
        { json: "frame", js: "frame", typ: u(a(r("Frame")), null) },
        { json: "gloss", js: "gloss", typ: "" },
        { json: "example", js: "example", typ: u(a(r("Example")), null) },
    ], false),
    "Example": o([
        { json: "wordNumber", js: "wordNumber", typ: 0 },
        { json: "templateNumber", js: "templateNumber", typ: 0 },
    ], false),
    "Frame": o([
        { json: "wordNumber", js: "wordNumber", typ: 0 },
        { json: "frameNumber", js: "frameNumber", typ: 0 },
    ], false),
    "Pointer": o([
        { json: "symbol", js: "symbol", typ: r("Symbol") },
        { json: "synset", js: "synset", typ: "" },
        { json: "source", js: "source", typ: 0 },
        { json: "target", js: "target", typ: 0 },
    ], false),
    "Symbol": [
        "*",
        ";c",
        "$",
        "=",
        "&",
        "@",
        "~i",
        "~",
        "<",
        "#m",
        ">",
        "%p",
        "!",
        ";r",
        "%s",
        "\\",
        "+",
        "-c",
        "@i",
        "%m",
        "#p",
        "-r",
        "#s",
        "-u",
        "^",
        ";u",
    ],
    "Pos": [
        "a",
        "n",
        "r",
        "s",
        "v",
    ],
};
