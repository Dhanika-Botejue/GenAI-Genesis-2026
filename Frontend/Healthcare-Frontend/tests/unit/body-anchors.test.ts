import { describe, expect, it } from 'vitest';
import { bodyAnchors, getBodyAnchorPlacement } from '@/lib/scene/body-anchors';

describe('body anchor mapping', () => {
  it('keeps the anatomical left side on positive X for the front-facing model', () => {
    expect(bodyAnchors.leftArm.position[0]).toBeGreaterThan(0);
    expect(bodyAnchors.leftLeg.position[0]).toBeGreaterThan(0);
    expect(bodyAnchors.rightArm.position[0]).toBeLessThan(0);
    expect(bodyAnchors.rightLeg.position[0]).toBeLessThan(0);
  });

  it('maps heart and liver to opposite torso sides', () => {
    expect(bodyAnchors.heart.position[0]).toBeGreaterThan(0);
    expect(bodyAnchors.liver.position[0]).toBeLessThan(0);
  });

  it('returns a forward marker position in front of the mesh surface', () => {
    const placement = getBodyAnchorPlacement({
      anchorId: 'chest',
      index: 0,
      count: 1,
      selected: false,
    });

    expect(placement.position[2]).toBeGreaterThan(bodyAnchors.chest.position[2]);
    expect(placement.scaleMultiplier).toBeGreaterThan(1);
  });
});
