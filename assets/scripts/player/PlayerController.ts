import {
    _decorator, Component, Node, RigidBody2D, CircleCollider2D,
    Vec2, Input, input, EventKeyboard, KeyCode,
    PhysicsSystem2D, Contact2DType, Collider2D, director,
    AudioSource, Sprite, UITransform, v2
} from 'cc';
const { ccclass, property } = _decorator;

// 玩家状态枚举
enum PlayerState {
    IDLE,
    WALKING,
    JUMPING,
    KICKING,
    FALLING
}

@ccclass('PlayerController')
export class PlayerController extends Component {

    // ── 物理参数 ──────────────────────────────────────
    @property({ tooltip: '移动速度' })
    moveSpeed: number = 200;

    @property({ tooltip: '跳跃力度' })
    jumpForce: number = 450;

    @property({ tooltip: '踢腿力度' })
    kickForce: number = 300;

    @property({ tooltip: '最大空中横移速度' })
    airControl: number = 0.7;

    // ── 节点引用 ──────────────────────────────────────
    @property(Node)
    bodyNode: Node = null;    // 圆形身体

    @property(Node)
    legNode: Node = null;     // 腿部节点

    @property(AudioSource)
    audioSource: AudioSource = null;

    // ── 私有状态 ──────────────────────────────────────
    private _rb: RigidBody2D = null;
    private _collider: CircleCollider2D = null;
    private _state: PlayerState = PlayerState.IDLE;
    private _isGrounded: boolean = false;
    private _groundCount: number = 0;       // 接触地面的碰撞数
    private _facingRight: boolean = true;
    private _kickCooldown: number = 0;
    private _kickDuration: number = 0;

    // 输入缓冲
    private _leftDown: boolean = false;
    private _rightDown: boolean = false;
    private _jumpPressed: boolean = false;
    private _kickPressed: boolean = false;

    onLoad() {
        this._rb = this.getComponent(RigidBody2D);
        this._collider = this.getComponent(CircleCollider2D);

        // 限制旋转，防止球滚动
        this._rb.allowSleep = false;
        this._rb.fixedRotation = true;
        this._rb.gravityScale = 2.5;

        // 注册碰撞事件
        this._collider.on(Contact2DType.BEGIN_CONTACT, this._onBeginContact, this);
        this._collider.on(Contact2DType.END_CONTACT, this._onEndContact, this);

        // 注册键盘事件
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this._onKeyUp, this);
    }

    onDestroy() {
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this._onKeyUp, this);
    }

    // ── 输入处理 ──────────────────────────────────────
    private _onKeyDown(evt: EventKeyboard) {
        switch (evt.keyCode) {
            case KeyCode.KEY_A:
            case KeyCode.ARROW_LEFT:
                this._leftDown = true;
                break;
            case KeyCode.KEY_D:
            case KeyCode.ARROW_RIGHT:
                this._rightDown = true;
                break;
            case KeyCode.SPACE:
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_W:
                this._jumpPressed = true;
                break;
            case KeyCode.KEY_J:
            case KeyCode.KEY_Z:
            case KeyCode.KEY_X:
                this._kickPressed = true;
                break;
        }
    }

    private _onKeyUp(evt: EventKeyboard) {
        switch (evt.keyCode) {
            case KeyCode.KEY_A:
            case KeyCode.ARROW_LEFT:
                this._leftDown = false;
                break;
            case KeyCode.KEY_D:
            case KeyCode.ARROW_RIGHT:
                this._rightDown = false;
                break;
            case KeyCode.SPACE:
            case KeyCode.ARROW_UP:
            case KeyCode.KEY_W:
                this._jumpPressed = false;
                break;
            case KeyCode.KEY_J:
            case KeyCode.KEY_Z:
            case KeyCode.KEY_X:
                this._kickPressed = false;
                break;
        }
    }

    // ── 物理碰撞 ──────────────────────────────────────
    private _onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D) {
        // 判断是否落地（只检测脚下方向）
        const otherY = otherCollider.node.worldPosition.y;
        const selfY = this.node.worldPosition.y;
        if (otherY < selfY) {
            this._groundCount++;
            this._isGrounded = true;
        }

        // 踢中物体
        if (this._kickDuration > 0 && otherCollider.node.getComponent('InteractableObject')) {
            this._doKickObject(otherCollider.node);
        }
    }

    private _onEndContact(selfCollider: Collider2D, otherCollider: Collider2D) {
        const otherY = otherCollider.node.worldPosition.y;
        const selfY = this.node.worldPosition.y;
        if (otherY < selfY) {
            this._groundCount = Math.max(0, this._groundCount - 1);
            if (this._groundCount === 0) {
                this._isGrounded = false;
            }
        }
    }

    // ── 每帧逻辑 ──────────────────────────────────────
    update(dt: number) {
        this._kickCooldown = Math.max(0, this._kickCooldown - dt);
        this._kickDuration = Math.max(0, this._kickDuration - dt);

        this._handleMovement(dt);
        this._handleJump();
        this._handleKick();
        this._updateAnimation();
        this._clampVelocity();
    }

    private _handleMovement(dt: number) {
        const vel = this._rb.linearVelocity;
        let targetVX = 0;

        if (this._leftDown)  targetVX -= this.moveSpeed;
        if (this._rightDown) targetVX += this.moveSpeed;

        // 空中控制减弱
        const control = this._isGrounded ? 1.0 : this.airControl;

        // 平滑加速
        const newVX = vel.x + (targetVX - vel.x) * control * Math.min(dt * 15, 1);
        this._rb.linearVelocity = new Vec2(newVX, vel.y);

        // 朝向
        if (targetVX > 0) this._facingRight = true;
        else if (targetVX < 0) this._facingRight = false;

        // 翻转节点
        const scaleX = this._facingRight ? 1 : -1;
        if (this.node.scale.x !== scaleX) {
            this.node.setScale(scaleX, this.node.scale.y, this.node.scale.z);
        }
    }

    private _handleJump() {
        if (this._jumpPressed && this._isGrounded) {
            this._jumpPressed = false;
            const vel = this._rb.linearVelocity;
            this._rb.linearVelocity = new Vec2(vel.x, this.jumpForce);
            this._state = PlayerState.JUMPING;
            this._playSound('jump');
        }
        this._jumpPressed = false; // 消耗输入
    }

    private _handleKick() {
        if (this._kickPressed && this._kickCooldown <= 0) {
            this._kickPressed = false;
            this._kickCooldown = 0.5;
            this._kickDuration = 0.2;
            this._state = PlayerState.KICKING;

            // 踢腿冲量：向前方施加一个小推力
            const dir = this._facingRight ? 1 : -1;
            const vel = this._rb.linearVelocity;
            this._rb.linearVelocity = new Vec2(vel.x + dir * 80, vel.y);
            this._playSound('kick');
        }
        this._kickPressed = false;
    }

    private _doKickObject(target: Node) {
        const rb = target.getComponent(RigidBody2D);
        if (rb) {
            const dir = this._facingRight ? 1 : -1;
            rb.linearVelocity = new Vec2(
                dir * this.kickForce,
                this.kickForce * 0.6
            );
        }
    }

    private _clampVelocity() {
        const vel = this._rb.linearVelocity;
        const maxFall = -800;
        if (vel.y < maxFall) {
            this._rb.linearVelocity = new Vec2(vel.x, maxFall);
        }
    }

    // ── 动画更新 ──────────────────────────────────────
    private _updateAnimation() {
        const vel = this._rb.linearVelocity;
        const moving = Math.abs(vel.x) > 10;

        if (this._kickDuration > 0) {
            this._state = PlayerState.KICKING;
        } else if (!this._isGrounded) {
            this._state = vel.y > 0 ? PlayerState.JUMPING : PlayerState.FALLING;
        } else if (moving) {
            this._state = PlayerState.WALKING;
        } else {
            this._state = PlayerState.IDLE;
        }

        // 腿部动画（简单旋转模拟走路）
        if (this.legNode) {
            const t = Date.now() / 1000;
            if (this._state === PlayerState.WALKING) {
                const angle = Math.sin(t * 12) * 20;
                this.legNode.setRotationFromEuler(0, 0, angle);
            } else if (this._state === PlayerState.KICKING) {
                this.legNode.setRotationFromEuler(0, 0, this._facingRight ? -40 : 40);
            } else {
                this.legNode.setRotationFromEuler(0, 0, 0);
            }
        }

        // 身体轻微弹性压缩（着陆时）
        if (this.bodyNode && this._isGrounded) {
            const speedFactor = Math.abs(vel.x) / this.moveSpeed;
            const scaleY = 1 - speedFactor * 0.05;
            const scaleX = 1 + speedFactor * 0.05;
            this.bodyNode.setScale(scaleX, scaleY, 1);
        } else if (this.bodyNode) {
            this.bodyNode.setScale(1, 1, 1);
        }
    }

    private _playSound(name: string) {
        if (this.audioSource) {
            // audioSource.playOneShot(clip) — 根据实际音频资源调用
        }
    }

    // ── 公共接口 ──────────────────────────────────────
    get isGrounded() { return this._isGrounded; }
    get state() { return this._state; }
    get facingRight() { return this._facingRight; }
}
