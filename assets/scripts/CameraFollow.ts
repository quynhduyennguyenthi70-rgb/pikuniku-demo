import {
    _decorator, Component, Node, Vec3, Camera, view,
    math, Rect
} from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CameraFollow')
export class CameraFollow extends Component {

    @property(Node)
    target: Node = null;        // 跟随目标（玩家）

    @property({ tooltip: '跟随平滑度（越小越丝滑）' })
    smoothSpeed: number = 5;

    @property({ tooltip: '摄像机前瞻偏移（X方向）' })
    lookAheadX: number = 60;

    @property({ tooltip: '摄像机垂直偏移' })
    offsetY: number = 40;

    // 关卡边界（防止摄像机移出地图）
    @property({ tooltip: '关卡左边界' })
    boundsLeft: number = -2000;
    @property({ tooltip: '关卡右边界' })
    boundsRight: number = 2000;
    @property({ tooltip: '关卡下边界' })
    boundsBottom: number = -500;
    @property({ tooltip: '关卡上边界' })
    boundsTop: number = 1000;

    private _desiredPos: Vec3 = new Vec3();
    private _halfW: number = 0;
    private _halfH: number = 0;

    start() {
        const size = view.getVisibleSize();
        this._halfW = size.width / 2;
        this._halfH = size.height / 2;
    }

    lateUpdate(dt: number) {
        if (!this.target) return;

        const tp = this.target.worldPosition;

        // 目标位置（带前瞻）
        const playerCtrl = this.target.getComponent('PlayerController') as any;
        const lookDir = playerCtrl?.facingRight ? 1 : -1;

        this._desiredPos.set(
            tp.x + lookDir * this.lookAheadX,
            tp.y + this.offsetY,
            this.node.worldPosition.z
        );

        // 限制在关卡边界内
        this._desiredPos.x = math.clamp(
            this._desiredPos.x,
            this.boundsLeft + this._halfW,
            this.boundsRight - this._halfW
        );
        this._desiredPos.y = math.clamp(
            this._desiredPos.y,
            this.boundsBottom + this._halfH,
            this.boundsTop - this._halfH
        );

        // 平滑插值
        const current = this.node.worldPosition;
        const newX = current.x + (this._desiredPos.x - current.x) * Math.min(dt * this.smoothSpeed, 1);
        const newY = current.y + (this._desiredPos.y - current.y) * Math.min(dt * this.smoothSpeed * 0.7, 1);

        this.node.setWorldPosition(newX, newY, current.z);
    }
}
