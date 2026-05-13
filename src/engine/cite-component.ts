/**
 * 🐝 HoneyComb — <hc-cite> Web Component
 * 
 * 纯 CSS hover 实现，不依赖 Shadow DOM，最大兼容性。
 * hover 时弹出气泡显示引用的详细内容和来源链接。
 * 
 * 用法：<hc-cite source="DuckDuckGo" url="https://..." detail="引用的具体内容">标注文字</hc-cite>
 */

export const HC_CITE_SCRIPT = `
<style>
hc-cite {
  position: relative;
  display: inline-block;
  vertical-align: baseline;
  border-bottom: 1.5px dashed #FFC107;
  cursor: pointer;
  transition: background 0.2s;
}
hc-cite:hover {
  background: rgba(255, 193, 7, 0.15);
}
hc-cite .hc-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #FFC107;
  color: #3D2C00;
  font-weight: 700;
  margin-left: 2px;
  vertical-align: super;
  line-height: 1;
}
hc-cite .hc-tip {
  display: none;
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 260px;
  max-width: 400px;
  padding: 14px 16px;
  background: #1A1A2E;
  color: #FFFDF5;
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  font-size: 13px;
  line-height: 1.6;
  z-index: 99999;
  white-space: normal;
  word-wrap: break-word;
  text-align: left;
  font-weight: normal;
  font-style: normal;
}
hc-cite .hc-tip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #1A1A2E;
}
hc-cite:hover .hc-tip {
  display: block;
}
hc-cite .hc-tip-src {
  font-weight: 700;
  color: #FFC107;
  font-size: 12px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 193, 7, 0.2);
}
hc-cite .hc-tip-detail {
  color: rgba(255, 253, 245, 0.85);
  font-size: 12.5px;
  line-height: 1.7;
}
hc-cite .hc-tip-link {
  display: inline-block;
  margin-top: 10px;
  font-size: 11px;
  color: #00D2FF;
  text-decoration: none;
  word-break: break-all;
  opacity: 0.8;
}
hc-cite .hc-tip-link:hover {
  text-decoration: underline;
  opacity: 1;
}
</style>
<script>
class HcCite extends HTMLElement {
  connectedCallback() {
    if (this.dataset.init) return;
    this.dataset.init = '1';
    const source = this.getAttribute('source') || '未知来源';
    const url = this.getAttribute('url') || '';
    const detail = this.getAttribute('detail') || '';
    const badge = document.createElement('span');
    badge.className = 'hc-badge';
    badge.textContent = 'i';
    this.appendChild(badge);
    const tip = document.createElement('div');
    tip.className = 'hc-tip';
    tip.innerHTML = '<div class="hc-tip-src">📎 ' + source + '</div>'
      + (detail ? '<div class="hc-tip-detail">' + detail.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' : '')
      + (url ? '<a class="hc-tip-link" href="' + url + '" target="_blank" rel="noopener">🔗 ' + url + '</a>' : '');
    this.appendChild(tip);
  }
}
if (!customElements.get('hc-cite')) {
  customElements.define('hc-cite', HcCite);
}
</script>
`;
