import {
    _decorator, Component, Node, RigidBody2D, Vec2,
    Contact2DType, Collider2D, tween, v3, Color, Sprite
} from 'cc';
const { ccclass, property } = _decorator;

// 可交互物体类型
export enum InteractType {
    ROCK,       // 石头（可踢飞）
    BOX,        // 木箱（可推动）
    SWITCH,     // 机关开关（踢触发）
    NPC,        // NPC（踢后有反应）
    SPRING,     // 弹簧（踩上弹起）
}

@ccclass('InteractableObject')
export class InteractableObject extends Component {

    @property({ type: InteractType, tooltip: '物体类型' })
    interactType: InteractType = InteractType.ROCK;

    @property({ tooltip: '被踢后的事件名（用于开关触发）' })
    triggerEvent: string = '';

    @property({ tooltip: '弹簧弹力（仅SPRING类型）' })
    springForce: number = 600;

    @property({ tooltip: '物体是否已被激活' })
    activated: boolean = false;

    private _rb: RigidBody2D = null;
    private _sprite: Sprite = null;
    private _originalPos: Vec3 = null;

    onLoad() {
        this._rb = this.getComponent(RigidBody2D);
        this._sprite = this.getComponentInChildren(Sprite);
        this._originalPos = this.node.worldPosition.clone();

        // 弹簧需要监听玩家踩踏
        if (this.interactType === InteractType.SPRING) {
            const collider = this.getComponent(Collider2D) ?? this.getComponentInChildren(Collider2D);
            if (collider) {
                collider.on(Contact2DType.BEGIN_CONTACT, this._onSpringContact, this);
            }
        }
    }

    // ── 被踢时调用（由 PlayerController 触发）──────────
    onKicked(direction: number, force: number) {
        switch (this.interactType) {
            case InteractType.ROCK:
            case InteractType.BOX:
                this._flyAway(direction, force);
                break;
            case InteractType.SWITCH:
                this._triggerSwitch();
                break;
            case InteractType.NPC:
                this._npcReaction(direction);
                break;
        }
    }

    private _flyAway(dir: number, force: number) {
        if (!this._rb) return;
        this._rb.type = RigidBody2D.Type.Dynamic;
        this._rb.linearVelocity = new Vec2(dir * force, force * 0.7);

        // 飞出后闪烁
        this._blinkEffect();
    }

    private _triggerSwitch() {
        if (this.activated) return;
        this.activated = true;

        // 颜色变化反馈
        if (this._sprite) {
            tween(this._sprite.color)
                .to(0.1, { r: 80, g: 220, b: 80 })
                .start();
        }

        // 广播事件（PlatformManager 监听）
        if (this.triggerEvent) {
            this.node.emit('switch_triggered', this.triggerEvent);
            // 也可以通过 GameManager 全局派发
            director.getScene().emit(this.triggerEvent);
        }

        // 节点缩放反馈
        tween(this.node)
            .to(0.1, { scale: v3(0.8, 1.2, 1) })
            .to(0.1, { scale: v3(1.1, 0.9, 1) })
            .to(0.1, { scale: v3(1, 1, 1) })
            .start();
    }

    private _npcReaction(kickDir: number) {
        if (!this._rb) return;
        // NPC 被踢后短暂飞出，然后爬起来
        this._rb.linearVelocity = new Vec2(kickDir * 200, 200);

        // 2秒后归位动画
        this.scheduleOnce(() => {
            tween(this.node)
                .to(0.5, { worldPosition: this._originalPos })
                .start();
        }, 2);
    }

    // ── 弹簧踩踏 ──────────────────────────────────────
    private _onSpringContact(selfCollider: Collider2D, otherCollider: Collider2D) {
        const playerCtrl = otherCollider.node.getComponent('PlayerController') as any;
        if (!playerCtrl) return;

        const playerRb = otherCollider.node.getComponent(RigidBody2D);
        if (playerRb) {
            playerRb.linearVelocity = new Vec2(
                playerRb.linearVelocity.x,
                this.springForce
            );
        }

        // 弹簧压缩动画
        tween(this.node)
            .to(0.05, { scale: v3(1.3, 0.6, 1) })
            .to(0.15, { scale: v3(0.9, 1.2, 1) })
            .to(0.1,  { scale: v3(1, 1, 1) })
            .start();
    }

    // ── 工具 ──────────────────────────────────────────
    private _blinkEffect() {
        let count = 0;
        const interval = this.schedule(() => {
            if (this._sprite) {
                this._sprite.node.active = !this._sprite.node.active;
            }
            count++;
            if (count >= 6) {
                this.unschedule(interval);
                if (this._sprite) this._sprite.node.active = true;
            }
        }, 0.08);
    }
}
