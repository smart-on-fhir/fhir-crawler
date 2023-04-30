import { expect }     from "chai"
import { urlencoded } from "express"
import jose           from "node-jose"
import { readFile }   from "fs/promises"
import jwt            from "jsonwebtoken"
import {
    DEFAULT_CONFIG,
    emptyFolder,
    invoke,
    mockServer
} from "./lib"


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


describe('Auth', function() {
    this.timeout(60000)

    afterEach(async () => {
        emptyFolder(__dirname + "/tmp")
    })    

    describe('Basic Auth', () => {
        
        it ("can use basic auth", (done) => {
            mockServer.mock("/fhir/Group/group-id/\\$export", {
                handler(req, res) {
                    try {
                        expect(req.headers.authorization).to.exist
                        let token = Buffer.from(String(req.headers.authorization).replace(/^basic\s+/i, ""), "base64").toString("utf8")
                        const [user, pass] = token.split(":")
                        expect(user).to.equal(DEFAULT_CONFIG.bulkClient.clientId)
                        expect(pass).to.equal(DEFAULT_CONFIG.bulkClient.privateJWKorSecret)
                        res.end("")
                        done()
                    } catch (e) {
                        done(e)
                    }
                }
            });

            invoke()
        })

        it ("fails with bad secret", async () => {
            mockServer.mock("/fhir/Group/group-id/\\$export", {
                status: 401,
                body: "Bad Secret"
            });

            await invoke({
                options: {
                    bulkClient: {
                        privateJWKorSecret: "badSecret"
                    }
                }
            }).then(
                () => { throw new Error("Did not fail") },
                () => {}
            )

            const errors = await readFile(__dirname + "/tmp/error_log.txt", "utf8")

            expect(errors).to.include('/fhir/Group/group-id/$export?_type=Patient --> 401 Unauthorized: "Bad Secret";')
        })
    })

    describe("Backend Services Auth", () => {
        it ("Can use Backend Services auth", async () => {

            // Kick-off
            mockServer.mock("/fhir/Group/group-id/\\$export", {
                status: 202,
                headers: { "content-location": mockServer.baseUrl + "/status" }
            })

            // Status
            mockServer.mock("/status", {
                body: {
                    transactionTime: new Date().toISOString(),
                    request: mockServer.baseUrl + "/fhir/Group/group-id/$export",
                    requiresAccessToken: false,
                    output: [],
                    error: []
                }
            })

            // Authorize
            mockServer.mock({ method: "post", path: "/auth/token" }, {
                bodyParser: urlencoded({ extended: false }),
                async handler(req, res) {
                    try {
                        const privateKey = await jose.JWK.asKey(PRIVATE_JWK, "json")
                        const publicKey = privateKey.toPEM(false)
                        jwt.verify(req.body.client_assertion, publicKey)
                        res.json({
                            access_token: jwt.sign("test-token", publicKey),
                            expires_in: 100
                        })
                    } catch (e) {
                        res.status(500).json({ message: String(e) })
                    }
                }
            })

            await invoke({
                options: {
                    bulkClient: {
                        privateJWKorSecret: PRIVATE_JWK
                    }
                }
            })
        })
    });

    describe('Bulk Data', () => {
        it ("can download patients", async () => {
            
            // Kick-off
            mockServer.mock("/fhir/Group/group-id/\\$export", {
                status: 202,
                headers: {
                    "content-location": mockServer.baseUrl + "/status"
                }
            })

            // Status
            let statusChecks = 0
            mockServer.mock("/status", {
                handler(req, res) {
                    switch (++statusChecks) {
                        case 1:
                            res.status(202)
                            res.send("")
                        break;
                        case 2:
                            res.status(202)
                            res.setHeader("retry-after", "0.1")
                            res.send("")
                        break;
                        case 3:
                            res.status(202)
                            res.setHeader("retry-after", new Date().toUTCString())
                            res.send("")
                        break;
                        default:
                            res.json({
                                transactionTime: new Date().toISOString(),
                                request: mockServer.baseUrl + "/fhir/Group/group-id/$export",
                                requiresAccessToken: false,
                                output: [{ type: "Patient", url: mockServer.baseUrl + "/patients.ndjson" }],
                                error: []
                            })
                        break;
                    }
                }
            })

            // Download patients
            mockServer.mock("/patients.ndjson", {
                body: '{"resourceType":"Patient"}\n{"resourceType":"Patient"}'
            })

            // Download Conditions - Page 1
            mockServer.mock("/fhir/Condition", {
                body: {
                    resourceType: "Bundle",
                    link: [
                        {
                            relation: "next",
                            url: mockServer.baseUrl + "/fhir/Condition2"
                        }
                    ],
                    entry: [
                        { resource : { resourceType: "Condition" } },
                        { resource : { resourceType: "Condition" } }
                    ]
                }
            })

            // Download Conditions - Page 2
            mockServer.mock("/fhir/Condition2", {
                body: {
                    resourceType: "Bundle",
                    link: [
                        {
                            relation: "next",
                            url: mockServer.baseUrl + "/fhir/Condition3"
                        }
                    ],
                    entry: [
                        { resource : { resourceType: "Condition" } },
                        { resource : { resourceType: "Condition" } }
                    ]
                }
            })

            // Download Conditions - Page 3
            mockServer.mock("/fhir/Condition3", {
                body: { resourceType: "OperationOutcome" }
            })

            await invoke({
                options: {
                    bulkClient: {
                        privateJWKorSecret: "secret"
                    },
                    resources: {
                        Condition: ""
                    }
                }
            })
        })
    })
})
