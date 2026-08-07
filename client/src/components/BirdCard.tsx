import type { Bird } from '../types';
import { IUCN_LABELS } from '../types';

interface Props {
  bird: Bird;
}

export default function BirdCard({ bird }: Props) {
  return (
    <div className="bird-card">
      <h3 className="bird-card-name">{bird.name}</h3>
      <p className="bird-card-sci">
        <i>{bird.sciName}</i>
      </p>
      <dl className="bird-card-facts">
        <div>
          <dt>目 / 科</dt>
          <dd>
            {bird.order} / {bird.family}
          </dd>
        </div>
        <div>
          <dt>体长 / 翼展</dt>
          <dd>
            {bird.lengthCm} cm / {bird.wingspanCm} cm
          </dd>
        </div>
        <div>
          <dt>居留</dt>
          <dd>{bird.residence.join('、')}</dd>
        </div>
        <div>
          <dt>栖息地</dt>
          <dd>{bird.habitats.join('、')}</dd>
        </div>
        <div>
          <dt>食性</dt>
          <dd>{bird.diet.join('、')}</dd>
        </div>
        <div>
          <dt>IUCN</dt>
          <dd>
            {bird.iucn}（{IUCN_LABELS[bird.iucn]}）
          </dd>
        </div>
        <div>
          <dt>国保等级</dt>
          <dd>{bird.chinaProtection}</dd>
        </div>
        <div>
          <dt>中国特有</dt>
          <dd>{bird.endemic ? '是' : '否'}</dd>
        </div>
      </dl>
    </div>
  );
}
