class Tracker {
    constructor() {
        this.center_points = {};
        this.id_count = 0;
    }

    update(objects_rect) {
        const objects_bbs_ids = [];

        for (const rect of objects_rect) {
            const [x, y, w, h] = rect;
            const cx = Math.floor((x + x + w) / 2);
            const cy = Math.floor((y + y + h) / 2);

            let same_object_detected = false;
            for (const [id, pt] of Object.entries(this.center_points)) {
                const dist = Math.hypot(cx - pt[0], cy - pt[1]);

                if (dist < 35) {
                    this.center_points[id] = [cx, cy];
                    objects_bbs_ids.push([x, y, w, h, parseInt(id)]);
                    same_object_detected = true;
                    break;
                }
            }

            if (!same_object_detected) {
                this.center_points[this.id_count] = [cx, cy];
                objects_bbs_ids.push([x, y, w, h, this.id_count]);
                this.id_count += 1;
            }
        }

        const new_center_points = {};
        for (const obj_bb_id of objects_bbs_ids) {
            const object_id = obj_bb_id[4];
            new_center_points[object_id] = this.center_points[object_id];
        }

        this.center_points = new_center_points;
        return objects_bbs_ids;
    }
}

module.exports = Tracker;
