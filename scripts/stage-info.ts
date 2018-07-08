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

// hubot.Robot<Adapter> の Adapter には 本来Adapterの型を入れるべきだが
// hubot-slackの型定義がないので any にしている
module.exports = (robot: hubot.Robot<any>): void => {
    // サーモンラン
    robot.respond(/(salmon|syake|バイト|ばいと)/i, async msg => {
        // TODO: キャッシュする
        const res = await client.get<ApiResponseWrapper<ApiSalmonJobInfo[]>>("/coop/schedule")
        if (res.status !== 200) {
            msg.reply("データ取得に失敗しました。(HTTP-"+res.status+")")
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
        msg.reply(replyStr.join("\n"))
    })

    // ステージ情報
    robot.respond(/stage|ステージ|すてーじ/i, async msg => {
        // TODO: キャッシュする
        const res = await client.get<ApiResponseWrapper<{[key in "gachi" | "league" | "regular"]: ApiBattleSchedule[]}>>("/schedule")
        if (res.status !== 200) {
            msg.reply("データ取得に失敗しました。(HTTP-"+res.status+")")
            return
        }
        console.log(res.data)
        const nowDate = Date.now()
        var replyStr = ["ステージ情報"]
        function stageInfo(schedules: ApiBattleSchedule[], isGachi = false) {
            schedules.forEach((info, index) => {
                if (index >= 3) return
                const start = info.start_t * 1000
                const end = info.end_t * 1000
                const isNowAvailable = start <= nowDate
                replyStr.push(`${isNowAvailable ? "現在" : ":soon:"} ${isGachi ? info.rule.replace("バトル", "\u3000") : ""} ${convertTimestampToHumanReadableString(start)} 〜 ${convertTimestampToHumanReadableString(end)} ステージ: ${info.maps.join(" / ")}`)
            })
        }
        replyStr.push("--- ナワバリ ---")
        stageInfo(res.data.result.regular)
        replyStr.push("--- ガチ ---")
        stageInfo(res.data.result.gachi, true)
        replyStr.push("--- リーグマッチ ---")
        stageInfo(res.data.result.league, true)
        msg.reply(replyStr.join("\n"))
    })

    // 死んでないか確認する用
    robot.respond(/ping/i, async msg => {
        msg.reply("pong")
    })
}