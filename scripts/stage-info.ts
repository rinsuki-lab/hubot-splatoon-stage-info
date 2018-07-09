import hubot = require("hubot")
import axios from "axios"
import moment = require("moment")
const { name, version } = require("../package.json")

const client = axios.create({
    baseURL: "https://spla2.yuu26.com",
    headers: {
        "User-Agent": `${name}/${version} (+https://rinsuki.net)`
    },
})

interface ApiResponseWrapper<ApiRes> {
    result: ApiRes
}

interface ApiSalmonWeapon {
    id: number
    image: string
    name: string
}

interface ApiSalmonJobInfo {
    start: string
    start_t: number
    start_utc: string
    end: string
    end_t: number
    end_utc: string
    stage?: {
        image: string
        name: string
    }
    weapons?: ApiSalmonWeapon[]
}

interface ApiBattleSchedule {
    start: string
    start_t: number
    start_utc: string
    end: string
    end_t: number
    end_utc: string

    rule: string
    maps: string[]
}


interface SalmonJobInfo {
    start: number
    end: number
    stage?: string
    weapons?: string[]
}


function convertSalmonJobInfo(input: ApiSalmonJobInfo): SalmonJobInfo {
    return {
        start: input.start_t * 1000,
        end: input.end_t * 1000,
        stage: input.stage && input.stage.name,
        weapons: input.weapons && input.weapons.map(weapon => weapon.name),
    }
}

function convertTimestampToHumanReadableString(timestamp: number) {
    return moment(timestamp).format("MM/DD HH:mm")
}

function logger(...args: any[]) {
    console.log(new Date(), ...args)
}

// hubot.Robot<Adapter> の Adapter には 本来Adapterの型を入れるべきだが
// hubot-slackの型定義がないので any にしている
module.exports = (robot: hubot.Robot<any>): void => {
    // サーモンラン
    robot.respond(/(salmon|syake|バイト|ばいと)/i, async msg => {
        // TODO: キャッシュする
        const res = await client.get<ApiResponseWrapper<ApiSalmonJobInfo[]>>("/coop/schedule")
        if (res.status !== 200) {
            msg.reply("データ取得に失敗しました。(HTTP-"+res.status+")")
            logger("salmon", msg.message.user.id, "failed", res.status)
            return
        }
        if (res.data.result.length === 0) {
            msg.reply("サーモンラン情報がありませんでした。")
            return
        }
        const nowDate = Date.now()
        var replyStr = ["サーモンラン スケジュール"]
        res.data.result.forEach((_info, _index) => {
            const info = convertSalmonJobInfo(_info)

            const isNowAvailable = info.start <= nowDate
            replyStr.push(`${isNowAvailable ? "現在" : ":soon:"} ${convertTimestampToHumanReadableString(info.start)} 〜 ${convertTimestampToHumanReadableString(info.end)} (${(info.end - info.start) / 1000 / 60 / 60}時間)`)
            if (info.stage) replyStr.push(`\u3000\u3000ステージ: ${info.stage}`)
            const weapons = info.weapons
            if (weapons) {
                weapons.forEach((weapon, index) => {
                    replyStr.push(`\u3000\u3000${index ? "\u3000\u3000" : "武器"}: ${weapon}`)
                })
            }
        })
        logger("salmon", msg.message.user.id, "success")
        msg.reply(replyStr.join("\n"))
    })

    // ステージ情報
    robot.respond(/stage|ステージ|すてーじ/i, async msg => {
        // TODO: キャッシュする
        const res = await client.get<ApiResponseWrapper<{[key in "gachi" | "league" | "regular"]: ApiBattleSchedule[]}>>("/schedule")
        if (res.status !== 200) {
            msg.reply("データ取得に失敗しました。(HTTP-"+res.status+")")
            logger("stage", msg.message.user.id, "failed", res.status)
            return
        }
        if (res.data.result.regular.length === 0) {
            msg.reply("ステージ情報が空でした。")
            logger("stage", msg.message.user.id, "failed-empty")
            return
        }
        const nowDate = Date.now()
        var replyStr = ["ステージ情報 (〜"+convertTimestampToHumanReadableString(res.data.result.regular[0].end_t * 1000)+")"]
        function stageInfo(name: string, schedules: ApiBattleSchedule[], isGachi = false) {
            schedules.forEach((info, index) => {
                if (index > 0) return
                info.maps.forEach((map, index) => {
                    const header = index === 0 ? `${info.rule.includes("バトル") ? "\u3000" : ""}${name}${isGachi ? ("\u200B*"+info.rule+"*\u200B").replace("バトル", "").replace("ガチ", "") : ""}` : "\u3000\u3000\u3000\u3000\u3000\u3000"
                    replyStr.push(`${header} : ${map}`)

                })
                // replyStr.push(`${isNowAvailable ? "現在" : ":soon:"}  ${convertTimestampToHumanReadableString(start)} 〜 ${convertTimestampToHumanReadableString(end)} ステージ: ${info.maps.join(" / ")}`)
            })
        }
        stageInfo("\u3000ナワバリ", res.data.result.regular)
        stageInfo("\u3000ガチ", res.data.result.gachi, true)
        stageInfo("リグマ", res.data.result.league, true)
        logger("stage", msg.message.user.id, "success")
        msg.reply(replyStr.join("\n"))
    })

    // 死んでないか確認する用
    robot.respond(/ping/i, async msg => {
        msg.reply("pong")
    })
}