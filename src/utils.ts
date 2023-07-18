import Path               from "path"
import { appendFile }     from "fs/promises"
import jwt                from "jsonwebtoken"
import jose               from "node-jose"
import fetch, { Headers } from "node-fetch"
import assert             from "assert"
import Logger             from "./Logger"
import {
    closeSync,
    openSync,
    PathLike,
    readdirSync,
    readSync,
    Stats,
    statSync,
    unlinkSync
} from "fs"


/**
 * Returns a promise that resolves after the given number of milliseconds
 */
export function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Prepends the `base` url to the `url`, unless `url` already starts with
 * http:// or https://
 */
export function toAbsolute(url: string, base: string) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return (base.replace(/\/$/, "") + url.replace(/^\/*/, "/"))
    }
    return url
}

/**
 * Appends a stringified version of the FHIR resource to the NDJSON file at 
 * destination. If the file does not exist it is created and the data is written
 * on the first line. Otherwise the data is appended preceded with EOL
 */
export async function appendToNdjson(resource: fhir4.Resource, destination: PathLike) {
    const line = JSON.stringify(resource)
    const stat = statSync(destination, { throwIfNoEntry: false })
    const eol = stat && stat.isFile() && stat.size > 0 ? "\n" : ""
    return appendFile(destination, eol + line)
}

export const print = (() => {
    
    const IS_TEST = process.env.NODE_ENV === "test"

    let lastLinesLength = 0;
    
    const _print = (lines: string | string[]) => {
        _print.clear();
        lines = Array.isArray(lines) ? lines : [lines];
        !IS_TEST && process.stdout.write(lines.join("\n") + "\n");
        lastLinesLength = lines.length
        return _print
    }

    _print.clear = () => {
        if (lastLinesLength) {
            !IS_TEST && process.stdout.write("\x1B[" + lastLinesLength + "A\x1B[0G\x1B[0J");
        }
        return _print
    };

    _print.commit = () => {
        lastLinesLength = 0
        return _print
    };

    return _print
})();

/**
 * Given a token response, computes and returns the expiresAt timestamp.
 * Note that this should only be used immediately after an access token is
 * received, otherwise the computed timestamp will be incorrect.
 */
export function getAccessTokenExpiration(tokenResponse: any): number
{
    const now = Math.floor(Date.now() / 1000);

    // Option 1 - using the expires_in property of the token response
    if (tokenResponse.expires_in) {
        return now + tokenResponse.expires_in;
    }

    // Option 2 - using the exp property of JWT tokens (must not assume JWT!)
    if (tokenResponse.access_token) {
        let tokenBody = jwt.decode(tokenResponse.access_token);
        if (tokenBody && typeof tokenBody == "object" && tokenBody.exp) {
            return tokenBody.exp;
        }
    }

    // Option 3 - if none of the above worked set this to 5 minutes after now
    return now + 300;
}

export async function getAccessToken({
    clientId,
    tokenEndpoint,
    privateJWK,
    resources
}: {
    clientId: string
    tokenEndpoint: string
    privateJWK: Record<string, any>,
    /**
     * List of ResourceTypes to request access to (Patient is inferred)
     */
    resources: string[]
}, logger: Logger) {

    const privateKey = await jose.JWK.asKey(privateJWK, "pem")
    
    const claims = {
        iss: clientId,
        sub: clientId,
        aud: tokenEndpoint,
        exp: Math.round(Date.now() / 1000) + 300,
        jti: jose.util.randomBytes(10).toString("hex")
    };

    const token = jwt.sign(claims, privateKey.toPEM(true), {
        algorithm: privateKey.alg as jwt.Algorithm,
        keyid    : privateKey.kid
    });

    const scope = [...resources, "Patient", "*"].map(x => `system/${x}.read`).join(" ");

    const body = new URLSearchParams()
    body.set("scope", scope)
    body.set("grant_type", "client_credentials")
    body.set("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer")
    body.set("client_assertion", token)

    const options = {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body
    };

    const start = Date.now()
    const res = await fetch(tokenEndpoint, options);

    await logger.request(tokenEndpoint, res, {
        ...options,
        body: options.body.toString().replace(/\bclient_assertion=.*?(&|$)/g, "client_assertion=****")
    }, Number(Date.now() - start).toLocaleString())

    assert.equal(res.status, 200, "Authentication failed!")

    const tokenResponse = await res.json()

    assert.ok(tokenResponse, "Authorization request got empty body")
    assert.ok(tokenResponse.access_token, "Authorization response does not include access_token")
    // assert.ok(tokenResponse.expires_in, "Authorization response does not include expires_in")

    return {
        token    : tokenResponse.access_token as string,
        expiresAt: getAccessTokenExpiration(tokenResponse)
    }
}

export function getPrefixedFileName(destination: string, fileName: string, maxFileSize: number) {
    let dst: string, counter = 0, stat: Stats | undefined;
    do {
        dst = Path.join(destination, ++counter + "." + fileName)
        stat = statSync(dst, { throwIfNoEntry: false })
    } while (stat && stat.isFile() && stat.size > maxFileSize)
    return dst
}

export function sweep(destination: string) {
    const items = readdirSync(destination);
    for (const file of items) {
        const path = Path.join(destination, file)
        if ((file === "manifest.json" || path.endsWith(".ndjson")) && statSync(path).isFile()) {
            unlinkSync(path)
        }
    }
}

/**
 * Reads a file line by line in a synchronous fashion. This will read the file
 * line by line without having to store more than one line in the memory (so the
 * file size does not really matter). This is much easier than an equivalent
 * readable stream implementation. It is also easier to debug and should produce
 * reliable stack traces in case of error.
 * @todo Add ability to customize the EOL or use a RegExp to match them all.
 * @param filePath The path to the file to read (preferably an absolute path)
 */
export function* readLine(filePath: string): IterableIterator<string> {
    const CHUNK_SIZE = 1024 * 64;
    const fd = openSync(filePath, "r");
    const chunk = Buffer.alloc(CHUNK_SIZE, "", "utf8");

    let eolPos: number;
    let blob = "";

    // $lab:coverage:off$
    while (true) {
    // $lab:coverage:on$
        eolPos = blob.indexOf("\n");

        // buffered line
        if (eolPos > -1) {
            yield blob.substring(0, eolPos);
            blob = blob.substring(eolPos + 1);
        }

        else {
            // Read next chunk
            const bytesRead = readSync(fd, chunk, 0, CHUNK_SIZE, null);
            if (!bytesRead) {
                closeSync(fd);
                break;
            }
            blob += chunk.subarray(0, bytesRead);
        }
    }

    // Last line
    if (blob) {
        yield blob;
    }
}

export function *ndjsonEntries<T=Record<string, any>>(path: string): IterableIterator<T> {
    const _lines = readLine(path);
    for (const line of _lines) {
        yield JSON.parse(line.trim());
    }
}

export function headersToObject(map: Headers) {
    const out: Record<string, string | string[]> = {}
    for (const [key, value] of map.entries()) {
        out[key] = value
    }
    return out
}

export const lock = (() => {
    let isLocked = false;
    return async function acquire(): Promise<() => void> {
        if (isLocked) {
            return new Promise(resolve => setTimeout(resolve, 10)).then(acquire)
        }
        isLocked = true
        return () => { isLocked = false }
    }
})()
