import { readFileSync, writeFileSync } from "fs"
import { expect }                      from "chai"
import jose                            from "node-jose"
import jwt                             from "jsonwebtoken"
import nock                            from "nock"
import { URLSearchParams }             from "url"
import { format }                      from "util"
import { emptyFolder }                 from "./lib"
import Logger                          from "../src/Logger"
import FhirClient                      from "../src/FhirClient"
import { BaseClientOptions }           from "../src/BaseClient"
import BulkDataClient                  from "../src/BulkDataClient"
import { wait }                        from "../src/utils"
import app                             from "../src/index"

const EHI_URL = "http://example.com"

const PRIVATE_JWK = {
    "kty": "RSA",
    "alg": "RS384",
    "n": "wYrXh4-wDtTS7tPVxNdl0mAyCd_IEUECR1Ew91b7BQYwow2at4L8PEQ1bRaGSxWATuviaD0Y9UhLzJ2DPMRDUzbao1evCkrKs-yY1ox1xPeNl8cE9RMTZIcGcAS4r8O_DlM4z-yNhUENi5vsY1qPPfde28FObAH3wr7e63viU-LUpJxJmTb5dSGWIearyDg9H8wZpQAR9k2GrZxqqS17mzEiEqtxUpiw26ABShqJQ4xgOAQoiE7WV3yvf36AqpcO2WtwwS6xwcLw55oZzou3MT2aGZPmNZkdyisGOU9A01REwrwxw6TVbabrb2kIINfDE-Wyes2ZocTJb_zNUZN5xw",
    "e": "AQAB",
    "d": "Bq-dMnmsQ1bm0olO4TXvtozMLbslVjNAuOX9Iw5GLa5BD-Dwb1Z_EDXrApG8oetkO1W6xI8XxaFxvOfUGM1O5hkHBI2K5nge-Ig7322Kw_spUQz3BuBZ0yc2-bewCaJhf0UwuT4axXex2BjS2bvPJvzcsgrDgseun3Ooj8n_z5X_DreQBSrKNpns6MG-9FQhkTDLt-aaYkrL0njXN3LnxhuvMjrCUEy8jCLaDHpPdiThTxGlIu4z5mw_RraMIU3uesXDJQHuaKN6j7Lqwy0qlnmEy5WchTikAyfAwLWSMAS7GL16SX9Wxqk3WCNbSMlOTy0NdBvdjKIH5akYJjUfQQ",
    "p": "5xfttF1T_iP8TanFDewG7Xln9dz415nj89W6zDx3FxDMzbgQscQTDPdlYuMQaoZKgZ6RmDTNP0YxMilfhIs17sJ7ORaKF6ssraS_CEuBnS65zwzAB6iT5mguX8ZnPF_Qbob2pTKXRxUkXHEYJfVZnbRFvQ9APBabtEg9ABqTaL0",
    "q": "1mbYVkg7s7Jfr0omLBlbKQ4m-hdetxf7bSjEexzeSGIy4bTXvzX6sHUIKrC5KnKW9pOvmcJkxnzsxHbuuEt4q1FB3cxxjvFJAqz6c2xuw6lmefbYYWWKDVecUkT2Kc_n5P4xwg2z-GjLJs_gU64jyfSArdNua_XzMwqwq9LmHtM",
    "dp": "ifXyFexlmWI4XNEOcCpJVHpXQyOBd41K1iXxl749RorkCahqZwXsbaBAadGu2jmDv3A_8UMMiUrJUe37NTC6qOh4EfPPyyOIz717wmL5ZTIhAWfWOHw-l534mXrj5No6n9F469SRFYGcrIdj6D1aG9kkjSLOsVC58d3ydN5oxG0",
    "dq": "0vXNJlDa1bzMo6jdGIU2ipYPSgNWweeKEGWNtum32hcto6KSquVNLvVovMC44Yhw_Fxi63M4P4nKWqH_0D0Kld9VZQ12K0VFJqnXoVzvO_ziBV4amPMVPH2ZJeYPJSMaNNrdUOi0zdcnFaBzRUNSmbPILcGdpAMUcoOxRNA2d9s",
    "qi": "L-GcGJ5s6XGofwfFE0HRdGg6UEwDuHUJo6hwksG9nc-AqLcNIvJ15Q90dfaqRN1UUza2zYiy7W1I3Vq4Z6OHguXQmdDHTCqCrGJLprvm9x473y2I55MVJ2JsjwPJePVNrJB_KF0zDYY6uYSSL8nTxLmXLBhxvLpKjBb3lkLDpBg"
}

const DEFAULT_BULK_OPTIONS = {
    baseUrl           : EHI_URL,
    clientId          : "bulkClientId",
    tokenEndpoint     : EHI_URL + "/token",
    privateJWKorSecret: "secret",
    groupId           : "group-id",
    retryAfterMSec    : 10,
    resources         : ["Encounter", "Condition", "Patient"],
    maxFileSize       : 1024 * 1024 * 1024,
    minPoolInterval   : 10,
    maxPoolInterval   : 200,
    retryLimit        : 5,
    retryDelay        : 100,
    retryStatusCodes  : [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
    requestTimeout    : 1000,
    destination       : "./test/tmp",
    logger            : new Logger(__dirname + "/tmp")
}

afterEach(async () => {
    emptyFolder(__dirname + "/tmp")
    nock.abortPendingRequests()
    nock.cleanAll()
})

describe("Bulk Export", function() {

    describe("basic auth", () => {

        it ("works as expected", async () => {
            nock(EHI_URL)
                .get("/Group/group-id/$export?_type=Patient")
                .basicAuth({ user: "bulkClientId", pass: "secret" })
                .reply(200, "", { "content-location": "whatever" });

            const bulkClient = new BulkDataClient(DEFAULT_BULK_OPTIONS)
            await bulkClient.kickOff()
        })

        it ("fails if the server replies with bad secret", async () => {
            nock(EHI_URL)
                .get("/Group/group-id/$export?_type=Patient")
                .reply(401, "Bad Secret");

            const bulkClient = new BulkDataClient(DEFAULT_BULK_OPTIONS)
            await bulkClient.kickOff().then(
                () => { throw new Error("Did not fail") },
                ex => {
                    expect((ex as Error).message).to.match(/401 Unauthorized: "Bad Secret";/)
                }
            )
        })

    })

    describe("Backend Services Auth", () => {
        it ("Works as expected", async () => {

            // Kick-off
            nock(EHI_URL).get("/Group/group-id/$export?_type=Patient").thrice().reply(202, "", { "content-location": EHI_URL + "/status" });
            
            // Status
            nock(EHI_URL)
                .get("/status")
                .reply(200, {
                    body: {
                        transactionTime: new Date().toISOString(),
                        request: EHI_URL + "/fhir/Group/group-id/$export",
                        requiresAccessToken: false,
                        output: [],
                        error: []
                    }
                })

            // Authorize
            nock(EHI_URL)
                .post("/token")
                .twice()
                .reply(async function(uri, body) {
                    try {
                        const privateKey = await jose.JWK.asKey(PRIVATE_JWK, "json")
                        const publicKey = privateKey.toPEM(false)
                        const params = new URLSearchParams(body)
                        jwt.verify(params.get("client_assertion")!, publicKey)
                        return [200, {
                            access_token: jwt.sign("test-token", publicKey),
                            expires_in: 1
                        }]
                    } catch (e) {
                        return [500, { message: String(e) } ]
                    }
                })

            const bulkClient = new BulkDataClient({
                ...DEFAULT_BULK_OPTIONS,
                privateJWKorSecret: PRIVATE_JWK,
            })

            // Fist using a fresh but very short-life token
            await bulkClient.kickOff()

            // Let the token expire
            await wait(100)

            // Should get a new token now
            await bulkClient.kickOff()
            
            // #3 - Use token `exp` instead of `expires_in`
            nock(EHI_URL)
                .post("/token")
                .twice()
                .reply(async function(uri, body) {
                    try {
                        const privateKey = await jose.JWK.asKey(PRIVATE_JWK, "json")
                        const publicKey = privateKey.toPEM(false)
                        const params = new URLSearchParams(body)
                        jwt.verify(params.get("client_assertion")!, publicKey)
                        return [200, { access_token: jwt.sign({}, publicKey, { expiresIn: 10 }) }]
                    } catch (e) {
                        console.log(e)
                        return [500, { message: String(e) } ]
                    }
                })
            
            await bulkClient.kickOff()
        })
    })

    it ("can download patients", async () => {
            
        // Kick-off
        nock(EHI_URL).get("/Group/group-id/$export?_type=Patient").reply(202, "", { "content-location": EHI_URL + "/status" });

        // Status
        let statusChecks = 0
        nock(EHI_URL).persist().get("/status").reply((uri, body) => {
            switch (++statusChecks) {
                case 1:
                    return [202, ""];
                case 2:
                    return [202, "", { "x-progress": "50%", "retry-after": "0.1"}]
                case 3:
                    return [202, "", { "x-progress": "100%", "retry-after": new Date().toUTCString()}]
                default:
                    return [200, {
                        transactionTime: new Date().toISOString(),
                        request: EHI_URL + "/Group/group-id/$export?_type=Patient",
                        requiresAccessToken: false,
                        output: [{ type: "Patient", url: EHI_URL + "/patients.ndjson" }],
                        error: []
                    }]
            }
        })
    
        // Download patients
        nock(EHI_URL).get("/patients.ndjson").reply(202, '{"resourceType":"Patient"}\n{"resourceType":"Patient"}');


        const bulkClient = new BulkDataClient(DEFAULT_BULK_OPTIONS)

        const log: string[] = [];
        const onProgress = (msg: string) => {
            log.push(msg)
        }

        const destination = __dirname + "/tmp"
        const statusUrl = await bulkClient.kickOff()
        const manifest  = await bulkClient.waitForExport(statusUrl, onProgress)
        expect(log).to.deep.equal(["working...", "50%", "100%"])
        const files     = await bulkClient.download(manifest, destination)
        expect(files).to.include(destination + "/1.Patient.ndjson")
    })

    it ("throws if status returns 4XX response", async () => {
            
        // Kick-off
        nock(EHI_URL).get("/Group/group-id/$export?_type=Patient").reply(202, "", { "content-location": EHI_URL + "/status" });

        // Status
        nock(EHI_URL).get("/status").reply(400, "This is a test error")

        const bulkClient = new BulkDataClient(DEFAULT_BULK_OPTIONS)
        const statusUrl = await bulkClient.kickOff()
        await bulkClient.waitForExport(statusUrl).then(
            () => { throw new Error("Did not throw") },
            ex => {
                expect((ex as Error).message).to.match(/This is a test error/)
            }
        )
    })

    it ("throws if status returns unexpected 2XX", async () => {
            
        // Kick-off
        nock(EHI_URL).get("/Group/group-id/$export?_type=Patient").reply(202, "", { "content-location": EHI_URL + "/status" });
    
        // Status
        nock(EHI_URL).get("/status").reply(206, "This is a test error")

        const bulkClient = new BulkDataClient(DEFAULT_BULK_OPTIONS)
        const statusUrl = await bulkClient.kickOff()
        await bulkClient.waitForExport(statusUrl).then(
            () => { throw new Error("Did not throw") },
            ex => {
                expect((ex as Error).message).to.equal("Unexpected bulk status response 206 Partial Content. Body: \"This is a test error\"")
            }
        )
    })
})

describe('FHIR Requests', function() {
    
    describe ("downloadResource", () => {
        this.timeout(1000)

        function createClient(options: Partial<BaseClientOptions> = {}) {
            return new FhirClient({
                clientId        : "",
                tokenEndpoint   : EHI_URL + "/token",
                privateJWKorSecret: "secret",
                baseUrl         : EHI_URL, // mockServer.baseUrl,
                resources       : ["Patient"],
                logger          : new Logger(__dirname + "/tmp"),
                retryStatusCodes: [],
                retryDelay      : 1,
                retryLimit      : 0,
                requestTimeout  : 60_000,
                destination     : __dirname + "/tmp",
                ...options
            })
        }

        describe ("Common errors", () => {

            

            const mocks: [[number, nock.ReplyBody?], RegExp][] = [
                [[400, "" ], /400 Bad Request/                 ],
                [[401, "" ], /401 Unauthorized/                ],
                [[403, "" ], /403 Forbidden/                   ],
                [[500, "" ], /500 Internal Server Error/       ],
                [[200, "" ], /Did not return a valid resource/ ],
                [[200     ], /Did not return a valid resource/ ],
                [[201     ], /Did not return a valid resource/ ],
                [[200, {} ], /Did not return a valid resource/ ],
                [[304, {} ], /Did not return a valid resource/ ],
                [[200, { resourceType: "BadResourceType" }], /expected resource of type "Patient" but got "BadResourceType"/ ],
            ];

            for (const [[status, body], errorRe] of mocks) {

                it (`${status} ${JSON.stringify(body || "")} -> ${errorRe}`, async () => {

                    const client = createClient()

                    const didNotThrowMsg = `Expected downloadResource() to throw an error but it didn't`

                    try {
                        nock(EHI_URL).get('/Patient').reply(status, body)
                    //     mockServer.mock("/Patient", mock)
                        await client.downloadResource("Patient")
                        throw new Error(didNotThrowMsg)
                    } catch (e) {
                        const error = e as Error
                        if (error.message === didNotThrowMsg) {
                            throw error
                        }

                        expect(
                            error.message,
                            format(
                                'Expected an error message matching %s; got: %s',
                                errorRe,
                                error.message
                            )
                        ).to.match(errorRe)
                    }
                })
            }
        })

        it ("ECONNRESET", async () => {
            const client = createClient({ baseUrl: EHI_URL })

            nock(EHI_URL).get('/Patient').replyWithError({
                code: 'ECONNRESET',
                message: "Test ECONNRESET error"
            });

            try {
                await client.downloadResource("Patient")
                throw new Error("Did not throw any error")
            } catch (ex) {
                expect((ex as Error).message).to.match(/Test ECONNRESET error/)
            }
        })

        it ("ECONNREFUSED", async () => {
            const client = createClient({ baseUrl: EHI_URL })

            nock(EHI_URL).get('/Patient').replyWithError({
                code: 'ECONNREFUSED',
                message: "Test ECONNREFUSED error"
            });

            try {
                await client.downloadResource("Patient")
                throw new Error("Did not throw any error")
            } catch (ex) {
                expect((ex as Error).message).to.match(/Test ECONNREFUSED error/)
            }
        })

        it ("No response", async () => {
            const client = createClient({
                baseUrl: EHI_URL,
                requestTimeout: 100,
                retryLimit: 0
            })

            nock(EHI_URL)
                .get('/Patient')
                .delayConnection(10_000)
                .reply(201);

            try {
                await client.downloadResource("Patient")
                throw new Error("Did not throw any error")
            } catch (ex) {
                expect((ex as Error).message).to.match(/Failed to get any response/)
            }
        })

        it ("can download single resource", async () => {

            const client = new FhirClient({
                clientId        : "",
                tokenEndpoint   : "",
                privateJWKorSecret: {},
                baseUrl         : EHI_URL,
                resources       : ["Patient"],
                logger          : new Logger(__dirname + "/tmp"),
                retryStatusCodes: [],
                retryDelay      : 1,
                retryLimit      : 0,
                requestTimeout  : 60_000,
                destination     : __dirname + "/tmp"
            })

            // @ts-ignore
            client.accessToken = "token"
            
            // @ts-ignore
            client.accessTokenExpiresAt = Date.now()

            nock(EHI_URL)
                .get('/Patient')
                .reply(200, { resourceType: "Patient" });

            await client.downloadResource("Patient")
        })

        it ("can download a bundle", async () => {

            const client = new FhirClient({
                clientId        : "",
                tokenEndpoint   : "",
                privateJWKorSecret: "secret",
                baseUrl         : "https://example.com",
                resources       : ["Patient"],
                logger          : new Logger(__dirname + "/tmp"),
                retryStatusCodes: [],
                retryDelay      : 1,
                retryLimit      : 0,
                requestTimeout  : 0,
                destination     : __dirname + "/tmp"
            })

            nock("https://example.com")
                .get('/Patient')
                .reply(200, {
                    resourceType: "Bundle",
                    entry: [
                        {
                            resource: {
                                resourceType: "Patient",
                                name: "Patient 1"
                            }
                        }
                    ],
                    link: [
                        {
                            relation: "next",
                            url: "https://example.com/page2"
                        }
                    ]
                });

            nock("https://example.com")
                .get('/page2')
                .reply(200, {
                    resourceType: "Bundle",
                    entry: [
                        {
                            resource: {
                                resourceType: "Patient",
                                name: "Patient 2"
                            }
                        }
                    ]
                });

            await client.downloadResource("Patient")
        })
    })
})

describe ("Full Export", () => {

    it ("can do full export", async () => {

        const CONFIG = {
            groupId         : "group-id",
            destination     : "./test/tmp",
            poolInterval    : 10,
            minPoolInterval : 10,
            maxPoolInterval : 200,
            throttle        : 0,
            maxFileSize     : 1024 * 1024 * 1024, // 1 GB
            retryStatusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
            retryDelay      : 10,
            retryLimit      : 1,
            requestTimeout  : 100,
            bulkClient: {
                clientId          : "bulkClientId",
                baseUrl           : "http://example.com/",
                tokenEndpoint     : "http://example.com/auth/token",
                privateJWKorSecret: "secret"
            },
            fhirClient: {
                clientId          : "fhirClientId",
                baseUrl           : "http://example.com/",
                tokenEndpoint     : "http://example.com/auth/token",
                privateJWKorSecret: "secret"
            },
            resources: {
                Encounter: `?patient=#{patientId}`,
                Condition: `?patient=#{patientId}`
            }
        };

        const configPath  = "./test/tmp/config.ts"

        writeFileSync(configPath,  "export default " + JSON.stringify(CONFIG, null, 4), "utf8")

        // Kick-off
        nock("http://example.com")
            .get("/Group/group-id/$export?_type=Patient")
            .reply(202, "", { "content-location": "http://example.com/status" });

        // Status 1
        nock("http://example.com")
            .get("/status")
            .reply(202, "", { "x-progress": "50%", "retry-after": "0.1" });
        
        // Status 2
        nock("http://example.com")
            .get("/status")
            .reply(200, {
                transactionTime: new Date().toUTCString(),
                request: "http://example.com/Group/group-id/$export?_type=Patient",
                requiresAccessToken: true,
                output: [
                    {
                        type: "Patient",
                        url: "http://example.com/0.Patient.ndjson"
                    }
                ],
                error: []
            });

        // Patients
        nock("http://example.com")
            .get("/0.Patient.ndjson")
            .reply(200, '{"resourceType":"Patient","id":1}\n{"resourceType":"Patient","id":2}');

        // Encounters
        nock("http://example.com")
            .get("/Encounter?patient=1")
            .reply(200, {
                resourceType: "Bundle",
                entry: [
                    { resource: { resourceType: "Encounter", id: 1, patient: 1 }},
                    { resource: { resourceType: "Encounter", id: 2, patient: 1 }}
                ]
            });
        nock("http://example.com")
            .get("/Encounter?patient=2")
            .reply(200, {
                resourceType: "Bundle",
                entry: [
                    { resource: { resourceType: "Encounter", id: 1, patient: 2 }},
                    { resource: { resourceType: "Encounter", id: 2, patient: 2 }}
                ]
            });

        // Conditions
        nock("http://example.com")
            .get("/Condition?patient=1")
            .reply(200, {
                resourceType: "Bundle",
                entry: [
                    { resource: { resourceType: "Condition", id: 1, patient: 1 }},
                    { resource: { resourceType: "Condition", id: 2, patient: 1 }}
                ]
            });
        nock("http://example.com")
            .get("/Condition?patient=2")
            .reply(200, {
                resourceType: "Bundle",
                entry: [
                    { resource: { resourceType: "Condition", id: 1, patient: 2 }},
                    { resource: { resourceType: "Condition", id: 2, patient: 2 }}
                ]
            });

        await app({ config: configPath })
    })

    it ("can do full export ignoring errors", async () => {

        const CONFIG = {
            groupId         : "group-id",
            destination     : "./test/tmp",
            poolInterval    : 10,
            minPoolInterval : 10,
            maxPoolInterval : 200,
            throttle        : 0,
            maxFileSize     : 1024 * 1024 * 1024, // 1 GB
            retryStatusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
            retryDelay      : 10,
            retryLimit      : 1,
            parallel        : 2,
            requestTimeout  : 100,
            bulkClient: {
                clientId          : "bulkClientId",
                baseUrl           : "http://example.com/",
                tokenEndpoint     : "http://example.com/auth/token",
                privateJWKorSecret: "secret"
            },
            fhirClient: {
                clientId          : "fhirClientId",
                baseUrl           : "http://example.com/",
                tokenEndpoint     : "http://example.com/auth/token",
                privateJWKorSecret: "secret"
            },
            resources: {
                Encounter: `?patient=#{patientId}`,
                Condition: `?patient=#{patientId}`
            }
        };

        const configPath  = "./test/tmp/config.ts"

        writeFileSync(configPath,  "export default " + JSON.stringify(CONFIG, null, 4), "utf8")

        // Kick-off
        nock("http://example.com")
            .get("/Group/group-id/$export?_type=Patient")
            .reply(202, "", { "content-location": "http://example.com/status" });

        // Status
        nock("http://example.com")
            .get("/status")
            .reply(200, {
                transactionTime: new Date().toUTCString(),
                request: "http://example.com/Group/group-id/$export?_type=Patient",
                requiresAccessToken: true,
                output: [
                    {
                        type: "Patient",
                        url: "http://example.com/0.Patient.ndjson"
                    }
                ],
                error: []
            });

        // Patients
        nock("http://example.com")
            .get("/0.Patient.ndjson")
            .reply(200, '{"resourceType":"Patient","id":1}\n{"resourceType":"Patient","id":2}\n{"resourceType":"Patient","id":3}');

        // Encounters
        nock("http://example.com")
            .get("/Encounter?patient=1")
            .reply(200, {
                resourceType: "Bundle",
                entry: [
                    { resource: { resourceType: "Encounter", id: 1, patient: 1 }},
                    { resource: { resourceType: "Encounter", id: 2, patient: 1 }}
                ]
            });
        nock("http://example.com")
            .get("/Encounter?patient=2")
            .reply(200, {
                resourceType: "Bundle",
                entry: [
                    { resource: { resourceType: "Encounter", id: 1, patient: 2 }},
                    { resource: { resourceType: "Encounter", id: 2, patient: 2 }}
                ]
            });
        nock("http://example.com").get("/Condition?patient=3").reply(404, "Leaf-level not found error");

        // Conditions
        nock("http://example.com")
            .get("/Condition?patient=1")
            .reply(200, {
                resourceType: "Bundle",
                entry: [
                    { resource: { resourceType: "Condition", id: 1, patient: 1 }},
                    { resource: { resourceType: "Condition", id: 2, patient: 1 }}
                ]
            });
        nock("http://example.com").get("/Condition?patient=2").reply(400, "Leaf-level error");
        nock("http://example.com").get("/Condition?patient=3").reply(404, "Leaf-level not found error");

        await app({ config: configPath })

        const errorLog = readFileSync("./test/tmp/error_log.txt", "utf8")

        expect(errorLog).to.include('FetchError: GET http://example.com/Condition?patient=2 --> 400 Bad Request: "Leaf-level error"')
        expect(errorLog).to.include('FetchError: GET http://example.com/Condition?patient=3 --> 404 Not Found: "Leaf-level not found error"')
    })
})
