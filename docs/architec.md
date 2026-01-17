# 🏛️ Mimari ve Tasarım Kararları

WILD LANDS, web tabanlı bir oyunun performans ve yönetilebilirlik dengesini sağlamak adına **Atomik Tasarım** ve **Bileşen Tabanlı Mimari** üzerine inşa edilmiştir.

## 🛠️ Teknoloji Yığını
- **UI Katmanı:** React 19 (Hooks, Ref, Portals).
- **Render Motoru:** Three.js (WebGL tabanlı 3D rendering).
- **Styling:** Tailwind CSS (Modern ve hızlı UI geliştirme).
- **State Management:** React `useState` & `useRef` (Oyun döngüsü performansı için mutable ref kullanımı).

## 🏗️ Mimari Yapı

### 1. `App.tsx` (Oyun Motoru & State)
Tüm oyun mantığının (mantıksal döngülerin, istatistik azalmalarının ve kayıt sisteminin) yönetildiği ana bileşendir. `1000ms` aralıklarla çalışan bir "Survival Tick" mekanizması içerir.

### 2. `GameScene.tsx` (Görsel Katman)
Three.js sahnesinin oluşturulduğu, PointerLock kontrollerinin ve 3D objelerin (ağaçlar, hayvanlar, barınaklar) yönetildiği katmandır. Performans için `requestAnimationFrame` döngüsü burada çalışır.

### 3. `UIOverlay.tsx` (Arayüz Katmanı)
Kullanıcının istatistiklerini gördüğü, envanterle etkileşime girdiği ve crafting yaptığı 2D HUD katmanıdır. `pointer-events: none` ile 3D sahneye tıklanabilirlik engellenmez.

## ⚖️ Tasarım Kararları

### Neden `useRef` Kullanıldı?
React'ın state güncelleme mekanizması (re-render) 60 FPS çalışan bir 3D oyunu yavaşlatabilir. Bu yüzden kamera koordinatları ve zaman gibi sürekli değişen veriler `useRef` içinde tutulur ve yalnızca gerekli UI güncellemeleri için `useState` tetiklenir.

### Çarpışma (Collision) Sistemi
Ağaçlar ve kayalar için basit dairesel mesafe kontrolü kullanılır. Barınaklar için ise "Hollow Box" (boşluklu kutu) mantığı geliştirilerek oyuncunun yapıların içine girmesi sağlanmıştır.

### Varlık Yönetimi (Asset Management)
Tüm asset'ler (sesler ve dokular) uygulama başlangıcında `loading` ekranında preload edilir, böylece oyun sırasında gecikmeler önlenir.
