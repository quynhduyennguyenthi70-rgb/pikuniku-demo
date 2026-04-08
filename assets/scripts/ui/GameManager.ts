import {
    _decorator, Component, Node, director, Director,
    Label, ProgressBar, tween, v3, sys
} from 'cc';
const { ccclass, property } = _decorator;

// 单例模式全局管理器
@ccclass('GameManager')
export class GameManager extends Component {

    private static _instance: GameManager = null;
    static get instance(): GameManager {
        return GameManager._instance;
    }

    // ── 场景引用 ──────────────────────────────────────
    @property(Node)
    uiRoot: Node = null;

    @property(Label)
    coinLabel: Label = null;

    @property(Node)
    pausePanel: Node = null;

    @property(Node)
    gameOverPanel: Node = null;

    // ── 游戏状态 ──────────────────────────────────────
    private _coins: number = 0;
    private _isPaused: boolean = false;
    private _collectedItems: Set<string> = new Set();

    onLoad() {
        if (GameManager._instance && GameManager._instance !== this) {
            this.node.destroy();
            return;
        }
        GameManager._instance = this;
        director.addPersistRootNode(this.node); // 跨场景保留

        // 监听全局开关事件
        director.getScene()?.on('switch_triggered', this._onSwitchTriggered, this);
    }

    start() {
        if (this.pausePanel) this.pausePanel.active = false;
        if (this.gameOverPanel) this.gameOverPanel.active = false;
        this._updateCoinUI();
    }

    // ── 硬币系统 ──────────────────────────────────────
    addCoin(amount: number = 1) {
        this._coins += amount;
        this._updateCoinUI();

        // 弹跳动画
        if (this.coinLabel) {
            tween(this.coinLabel.node)
                .to(0.08, { scale: v3(1.3, 1.3, 1) })
                .to(0.12, { scale: v3(1, 1, 1) })
                .start();
        }
    }

    private _updateCoinUI() {
        if (this.coinLabel) {
            this.coinLabel.string = `× ${this._coins}`;
        }
    }

    // ── 收集物系统 ──────────────────────────────────────
    collectItem(itemId: string) {
        if (this._collectedItems.has(itemId)) return false;
        this._collectedItems.add(itemId);
        return true;
    }

    hasCollected(itemId: string): boolean {
        return this._collectedItems.has(itemId);
    }

    // ── 开关触发 ──────────────────────────────────────
    private _onSwitchTriggered(eventName: string) {
        console.log(`[GameManager] Switch triggered: ${eventName}`);
        // 找到对应门/平台并激活
        const target = director.getScene().getChildByName(eventName);
        if (target) {
            tween(target)
                .to(0.3, { scale: v3(0, 1, 1) })  // 门关闭/消失
                .call(() => { target.active = false; })
                .start();
        }
    }

    // ── 暂停系统 ──────────────────────────────────────
    togglePause() {
        this._isPaused = !this._isPaused;
        director.isPaused() ? director.resume() : director.pause();
        if (this.pausePanel) {
            this.pausePanel.active = this._isPaused;
        }
    }

    // ── 场景切换 ──────────────────────────────────────
    loadScene(name: string) {
        director.loadScene(name);
    }

    restartScene() {
        director.loadScene(director.getScene().name);
    }

    // ── 玩家死亡 ──────────────────────────────────────
    onPlayerDeath() {
        // 野餐大冒险里死亡惩罚几乎为零，直接原地复活即可
        this.scheduleOnce(() => {
            this.restartScene();
        }, 1.0);

        if (this.gameOverPanel) {
            this.gameOverPanel.active = true;
        }
    }
}
