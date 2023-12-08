import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import * as NearAPI from 'near-api-js';
import * as cheerio from 'cheerio';
import OpenAI from "openai";

const socket = new WebSocket('wss://api.calimero.network/api/v1/shards/cali-public-portal-calimero/meroship/ws');
const events = new EventEmitter();
let pingInterval = null;

const openai = new OpenAI();

let BOT_ACCOUNT = "YOUR_BOT_NAME.near" // e.g. hackai.near
let BOT_PRIVATE_KEY = "ed25519:BOTS_RAW_PRIVATE_KEY"
let X_API_KEY = "PASTE_CALIMERO_API_KEY"

if (process.env.BOT_ACCOUNT) {
    BOT_ACCOUNT = process.env.BOT_ACCOUNT;
}
if (process.env.BOT_PRIVATE_KEY) {
    BOT_PRIVATE_KEY = process.env.BOT_PRIVATE_KEY;
}
if (process.env.X_API_KEY) {
    X_API_KEY = process.env.X_API_KEY;
}

const CHANNEL = "askHackAI"
const AES_KEY = "1ca1f53db35b3a2f13f9cd9d1ecad6062dd72b96876775a19a7683abc048ae31"

async function send(cmd, args) {
    
    return new Promise((res, rej) => {
        if (pingInterval) {
            clearInterval(pingInterval);
        }
        const id = Math.floor(Math.random() * ((2 ** 53) - 1));
        events.once(id, (err, data) => {
            if (err) {
                return rej(err);
            }
            return res(data);
        });
        socket.send(JSON.stringify({id, command: cmd, args}));
        pingInterval = setInterval(() => {
            send("Ping", []);
        }, 15000);
    });
}

async function onOpen() {
    try {
        await send("Gateway::Headers", {"x-api-key": X_API_KEY});
    } catch (err) {
        if (!(err.type === "ParseError" &&
        typeof err.data === "string" &&
        err.data.startsWith("unknown variant `Gateway::Headers`"))) {
            console.log("[meroship] gateway auth header application failed ", err)
            return;
        }
    }

    await send("Ping", []);
    await send("Init", {"account_id": BOT_ACCOUNT});

    console.log('Connected to WebSocket server');
    await send("Subscribe", {"chat-nearcon.cali-public-portal": [CHANNEL] });
}


function decrypt(text, key, nonce) {
    if (!key) {
      return null;
    }

    try {
      const decipher = crypto.createDecipheriv(
        "aes-256-cbc",
        Buffer.from(key, 'hex'),
        Buffer.from(nonce, 'hex')
      );
      let decrypted = decipher.update(text, "base64", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (e) {
      console.log("Calimero.decrypt error: ", e.toString());
      return null;
    }
  }


  const encrypt = (text, key) => {
    let nonce = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(
        "aes-256-cbc",
        Buffer.from(key, 'hex'),
        Buffer.from(nonce, 'hex')
      );
    let encryptedData = cipher.update(text, "utf8", "base64");
    encryptedData += cipher.final("base64");

    console.log("encrypt", text, key, nonce, encryptedData);
    return {
      text: encryptedData.toString('base64'),
      nonce: nonce.toString('hex'),
    };
  };

function checkIfMsgForBot(message) {
    if (message.includes(BOT_ACCOUNT)) {
        const $ = cheerio.load(message);
    
        const pElement = $('p');
        const pContent = pElement.text();
    
        const prefix = `@${BOT_ACCOUNT}`;

        if (pContent.startsWith(prefix)) {
          const inputForChatGPT = pContent.substring(prefix.length);
          console.log(inputForChatGPT);
      
          return inputForChatGPT;
        }
      }
      return "";
}

async function askChatGPT(question) {
    console.log("Asking chatGPT: ", question);
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: question }],
      model: "gpt-3.5-turbo",
    });
  
    console.log(completion)
    console.log("-----")
    console.log(completion.choices[0].message.content);
  
    if (completion.choices.length == 0) {
      return "Please try again later...";
    }
  
    return completion.choices[0].message.content
  }

async function onMessage(data) {
    console.log(`Received message: ${data}`);

  const parsed = JSON.parse(data);
  if (parsed.id) {
    if (parsed.error) {
        events.emit(parsed.id, parsed.error);
    } else if (parsed.result) {
        events.emit(parsed.id, null, parsed.result);
    }
  } else if (parsed.event) {
    if (parsed.event.type === "ChannelMessage") {
        const decrypted_msg = decrypt(parsed.event.data.text, AES_KEY, parsed.event.data.nonce)
        console.log("DECRYPTED MSG:", decrypted_msg);

        const inputForChatGPT = checkIfMsgForBot(decrypted_msg);
        if (inputForChatGPT.length == 0) {
            // Bot not tagged
            return;
        }
        console.log(inputForChatGPT);

        let answer = await askChatGPT(inputForChatGPT);

        // Prepare for signing with Bot's priv key, and send the message
        const keyStore = new NearAPI.keyStores.InMemoryKeyStore();

        const keyPair = NearAPI.KeyPair.fromString(BOT_PRIVATE_KEY);

        await keyStore.setKey("mainnet", BOT_ACCOUNT, keyPair);

        let calimeroConnection = await NearAPI.connect({
            keyStore,
            networkId: "mainnet",
            nodeUrl: "https://api.calimero.network/api/v1/shards/cali-public-portal-calimero/neard-rpc/",
            headers: {
                'x-api-key': X_API_KEY
            },
        });

        const account = await calimeroConnection.account(BOT_ACCOUNT);
        console.log(account);

        let encrypted = encrypt(answer, AES_KEY)

        let txHash;
        let signedTx;
        try {
            [txHash, signedTx] = await account.signTransaction(
               "chat-nearcon.cali-public-portal", [
                NearAPI.transactions.functionCall(
                  "send_message",
                  {
                    group: { name: CHANNEL },
                    message: encrypted.text,
                    nonce: encrypted.nonce,
                    timestamp: Date.now()
                  },
                  "300000000000000",
                  "0"
                )
              ]
            );
            signedTx = Buffer.from(signedTx.encode()).toString("base64")
          } catch (e) {
            console.error(e);
          }

        await send("SubmitTransaction", [signedTx])
    }
  }
}


socket.on('open', onOpen);

socket.on('message', onMessage);

socket.on('close', (code, reason) => {
  console.log(`Connection closed with code ${code} and reason: ${reason}`);
});

socket.on('error', (error) => {
  console.error('WebSocket error:', error.message);
});