import fetch, { FetchError, RequestInit, Response } from "node-fetch"
import prompt                                       from "prompt-sync"
import clc                                          from "cli-color"
import Logger                                       from "./Logger"
import {
    getAccessToken,
    headersToObject,
    lock,
    print,
    toAbsolute,
    wait
} from "./utils"


export interface BaseClientOptions {
    clientId        : string
    tokenEndpoint   : string
    privateJWKorSecret: Record<string, any> | string
    baseUrl         : string
    resources       : string[]
    logger          : Logger
    retryStatusCodes: number[]
    retryDelay      : number
    retryLimit      : number
    [key: string]   : any
}

export default class BaseClient
{
    protected accessToken: string = ""

    protected accessTokenExpiresAt: number = 300

    public requestsCount: number = 0

    protected options: BaseClientOptions

    constructor(options: BaseClientOptions) {
        this.options = options
    }

    private async getAccessToken() {
        if (this.accessToken && this.accessTokenExpiresAt - 10 > Date.now() / 1000) {
            return this.accessToken;
        }

        const { token, expiresAt } = await getAccessToken({
            clientId     : this.options.clientId,
            tokenEndpoint: this.options.tokenEndpoint,
            privateJWK   : this.options.privateJWKorSecret as any,
            resources    : this.options.resources
        }, this.options.logger)

        this.accessToken = token
        this.accessTokenExpiresAt = expiresAt
        this.requestsCount++
        return token
    }

    protected async getAuthorizationHeader(): Promise<string> {
        if (typeof this.options.privateJWKorSecret === "string") {
            return "Basic " + Buffer.from(
                this.options.clientId + ":" + this.options.privateJWKorSecret
            ).toString("base64")
        }
        const release = await lock()
        const header = `Bearer ${ await this.getAccessToken() }`
        release()
        return header
    }

    protected async request<T=any>(url: string, options: RequestInit | undefined, raw: true): Promise<Response>;
    protected async request<T=any>(url: string, options: RequestInit | undefined, raw: boolean): Promise<{ response: Response, body: T }>;
    protected async request<T=any>(url: string, options?: RequestInit): Promise<{ response: Response, body: T }>;
    protected async request<T=any>(url: string, options?: RequestInit, raw?: boolean) {
        const { baseUrl, logger, retryLimit, retryDelay, retryStatusCodes } = this.options
        const _options: RequestInit = {
            ...options,
            headers: {
                accept: "application/json+fhir",
                ...options?.headers
            }
        };

        // Can opt-out by passing { authorization: undefined } in headers
        if (!("authorization" in _options.headers!)) {
            const authorization = await this.getAuthorizationHeader()
            if (authorization) {
                (_options.headers as any).authorization = authorization
            }

            if (options?.headers) {
                Object.assign(_options.headers as any, options.headers)
            }
        }

        url = toAbsolute(url, baseUrl)

        let response: Response, count = retryLimit
        do {
            await wait(count === retryLimit ? 0 : retryDelay)
            const start = Date.now()
            response = await fetch(url, _options)
            this.requestsCount++
            const time = Number(Date.now() - start).toLocaleString()
            await logger.request(url, response, _options, time)
        } while (!response.ok && retryStatusCodes.includes(response.status) && count--)

        // Manual retry
        while (!response.ok) {
            print.commit()
            
            const txt = await response.text()

            console.log(clc.bold.red("\n\nRequest failed!"))
            console.log(clc.bold.red("---------------------------------------"))
            console.log(clc.bold("\nRequest:"), clc.cyan(_options.method || "GET", url))
            console.log(clc.bold("\nRequest Body:"))
            console.log(_options.body)
            console.log(clc.bold("\nRequest Headers:"))
            console.log(_options.headers)
            console.log(clc.bold("\nResponse:"), response.status, response.statusText)
            console.log(clc.bold("\nResponse Headers:"))
            console.log(headersToObject(response.headers))
            console.log(clc.bold("\nResponse Body:"))
            console.log(clc.cyan(txt.substring(0, 200) + (txt.length > 200 ? "..." : "")))
            console.log(clc.beep);
            console.log(clc.bold.red("---------------------------------------\n\n"))

            await logger.error(
                "GET %s --> %s %s: %j; Response headers: %j",
                url,
                response.status,
                response.statusText,
                txt,
                response.headers.raw()
            )

            if (process.env.NODE_ENV !== "test") {
                const answer = prompt()(clc.yellow.bold("Would you like to retry this request? [Y/n]"));
                if (!answer || answer.toLowerCase() === 'y') {
                    this.requestsCount++
                    response = await fetch(url, _options)
                } else {
                    throw new FetchError("Request failed. See logs for details.", "fetch-error-" + response.status)
                }
            } else {
                throw new FetchError("Request failed. See logs for details.", "fetch-error-" + response.status)
            }
        }

        if (raw) {
            return response
        }
        
        let body = await response.text();
        let type = response.headers.get("Content-Type") + "";
        
        if (body.length && type.match(/\bjson\b/i)) {
            body = JSON.parse(body);
        }

        return { response, body: body as T }
    }
}
