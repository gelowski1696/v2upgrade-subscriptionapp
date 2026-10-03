import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FEATURE_GROUPS,
  type FeatureGroup,
  type FeatureValues,
} from '../../core/models/feature-mods';

@Component({
  selector: 'app-feature-editor',
  imports: [FormsModule],
  templateUrl: './feature-editor.html',
})
export class FeatureEditorComponent {
  @Input({ required: true }) values: FeatureValues = {};
  @Input() baseline: FeatureValues | null = null;
  @Input() disabled = false;
  @Input() readOnlyKeys: readonly string[] = [];
  @Output() readonly valuesChange = new EventEmitter<FeatureValues>();

  readonly groups = FEATURE_GROUPS;
  search = '';
  enabledOnly = false;
  pendingDisableGroup = '';

  visibleFeatures(group: FeatureGroup) {
    const query = this.search.trim().toLowerCase();
    return group.features.filter(
      (feature) =>
        (!this.enabledOnly || this.values[feature.key] === true) &&
        (!query ||
          feature.label.toLowerCase().includes(query) ||
          feature.description.toLowerCase().includes(query)),
    );
  }

  enabledCount(group?: FeatureGroup): number {
    const features = group?.features ?? this.groups.flatMap((item) => item.features);
    return features.filter((feature) => this.values[feature.key] === true).length;
  }

  totalCount(group?: FeatureGroup): number {
    return (group?.features ?? this.groups.flatMap((item) => item.features)).length;
  }

  isReadOnly(key: string): boolean {
    return this.disabled || this.readOnlyKeys.includes(key);
  }

  isOverride(key: string): boolean {
    return Boolean(this.baseline && this.baseline[key] !== this.values[key]);
  }

  toggle(key: string, enabled: boolean): void {
    if (this.isReadOnly(key)) return;
    this.valuesChange.emit({ ...this.values, [key]: enabled });
  }

  setGroup(group: FeatureGroup, enabled: boolean): void {
    if (!enabled && this.enabledCount(group) > 0) {
      this.pendingDisableGroup = group.label;
      return;
    }
    this.applyGroup(group, enabled);
  }

  confirmDisable(group: FeatureGroup): void {
    this.applyGroup(group, false);
    this.pendingDisableGroup = '';
  }

  cancelDisable(): void {
    this.pendingDisableGroup = '';
  }

  private applyGroup(group: FeatureGroup, enabled: boolean): void {
    const next = { ...this.values };
    for (const feature of group.features) {
      if (!this.isReadOnly(feature.key)) next[feature.key] = enabled;
    }
    this.valuesChange.emit(next);
  }

  resetAll(): void {
    if (!this.baseline) return;
    const next = { ...this.values };
    for (const group of this.groups) {
      for (const feature of group.features) {
        if (!this.isReadOnly(feature.key)) next[feature.key] = this.baseline[feature.key] === true;
      }
    }
    this.valuesChange.emit(next);
  }
}
