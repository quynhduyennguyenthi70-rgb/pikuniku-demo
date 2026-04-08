import {
    _decorator, Component, Node, Vec3, tween, v3,
    RigidBody2D, Vec2, director
} from 'cc';
const { ccclass, property } = _decorator;

// 移动平台配置
interface MovingPlatformConfig {
    pointA: Vec3;
    pointB: Vec3;
    speed: number;
    waitTime: number;
}

@ccclass('MovingPlatform')
export class MovingPlatform extends Component {

    @property({ tooltip: '终点偏移（相对当前位置）' })
    offsetB: Vec3 = new Vec3(200, 0, 0);

    @property({ tooltip: '移动速度（px/s）' })
    speed: number = 80;

    @property({ tooltip: '到达端点后等待时间（秒）' })
    waitTime: number = 0.5;

    private _pointA: Vec3 = null;
    private _pointB: Vec3 = null;

    start() {
        this._pointA = this.node.position.clone();
        this._pointB = new Vec3(
            this._pointA.x + this.offsetB.x,
            this._pointA.y + this.offsetB.y,
            0
        );
        this._moveTo(this._pointB);
    }

    private _moveTo(target: Vec3) {
        const dist = Vec3.distance(this.node.position, target);
        const duration = dist / this.speed;

        tween(this.node)
            .to(duration, { position: target })
            .delay(this.waitTime)
            .call(() => {
                const next = target === this._pointB ? this._pointA : this._pointB;
                this._moveTo(next);
            })
            .start();
    }
}

// ─────────────────────────────────────────────────────────────
// 死亡区域（掉落深渊触发重置）
// ─────────────────────────────────────────────────────────────
@ccclass('DeathZone')
export class DeathZone extends Component {

    onLoad() {
        const col = this.getComponent(Collider2D) ?? this.getComponentInChildren(Collider2D);
        col?.on(Contact2DType.BEGIN_CONTACT, this._onContact, this);
    }

    private _onContact(selfCol: any, otherCol: any) {
        if (otherCol.node.getComponent('PlayerController')) {
            GameManager.instance?.onPlayerDeath();
        }
    }
}

// ─────────────────────────────────────────────────────────────
// 硬币/收集物
// ─────────────────────────────────────────────────────────────
import { Collider2D, Contact2DType } from 'cc';
import { GameManager } from './GameManager';

@ccclass('Collectible')
export class Collectible extends Component {

    @property({ tooltip: '唯一ID（用于存档）' })
    itemId: string = '';

    @property({ tooltip: '加分值' })
    value: number = 1;

    @property({ tooltip: '收集后是否立刻销毁' })
    destroyOnCollect: boolean = true;

    start() {
        // 如果已收集（跨场景保留），直接隐藏
        if (this.itemId && GameManager.instance?.hasCollected(this.itemId)) {
            this.node.active = false;
            return;
        }

        // 上下浮动动画
        tween(this.node)
            .by(0.8, { position: new Vec3(0, 8, 0) }, { easing: 'sineInOut' })
            .by(0.8, { position: new Vec3(0, -8, 0) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();

        // 注册碰撞
        const col = this.getComponent(Collider2D);
        col?.on(Contact2DType.BEGIN_CONTACT, this._onContact, this);
    }

    private _onContact(selfCol: Collider2D, otherCol: Collider2D) {
        if (!otherCol.node.getComponent('PlayerController')) return;

        // 记录收集
        if (this.itemId) GameManager.instance?.collectItem(this.itemId);
        GameManager.instance?.addCoin(this.value);

        // 收集动画
        tween(this.node)
            .to(0.15, { scale: v3(1.5, 1.5, 1) })
            .to(0.1,  { scale: v3(0, 0, 1) })
            .call(() => {
                if (this.destroyOnCollect) this.node.destroy();
                else this.node.active = false;
            })
            .start();
    }
}

// ─────────────────────────────────────────────────────────────
// 场景过渡门（到达后切换到下一关）
// ─────────────────────────────────────────────────────────────
@ccclass('SceneExit')
export class SceneExit extends Component {

    @property({ tooltip: '目标场景名' })
    targetScene: string = 'Level2';

    onLoad() {
        const col = this.getComponent(Collider2D);
        col?.on(Contact2DType.BEGIN_CONTACT, this._onContact, this);
    }

    private _onContact(selfCol: Collider2D, otherCol: Collider2D) {
        if (otherCol.node.getComponent('PlayerController')) {
            GameManager.instance?.loadScene(this.targetScene);
        }
    }
}
