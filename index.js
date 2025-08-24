import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export {
    THREE,
    OrbitControls,
    RGBELoader,
    GLTFLoader,
    EffectComposer,
    RenderPass,
    UnrealBloomPass,
};

let renderer, scene, camera, controls, canvasElement;
const cards = [];
const CARD_COLORS = ['#ff5b54', '#ff9154', '#eeb94eff', '#e1ff54', '#54ffe6', '#548cff'];


// --- [3단계 추가] 마우스 클릭 감지를 위한 변수 ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let msnry;


function init() {
    // 1. 렌더러 설정
    canvasElement = document.querySelector('#three-canvas');
    renderer = new THREE.WebGLRenderer({
        canvas: canvasElement,
        antialias: true,
        alpha: true // 배경을 투명하게 처리
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
    renderer.shadowMap.enabled = false;


    // 2. 씬 설정
    scene = new THREE.Scene();

    // 3. 카메라 설정
    camera = new THREE.PerspectiveCamera(
        36,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 2, 25); // 카드들이 잘 보이도록 카메라 위치 조정
    scene.add(camera);

    // 4. 컨트롤 설정
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableZoom = false; // 줌 기능 비활성화
    controls.enablePan = false; // 패닝(이동) 기능 비활성화

    // --- [2단계 수정] 카메라 회전 각도 제한 ---
    // 수직(위아래) 회전 제한. 0은 맨 위(북극), Math.PI는 맨 아래(남극)
    controls.minPolarAngle = Math.PI / 3; // 아래로는 60도 이상 못 봄
    controls.maxPolarAngle = Math.PI / 2; // 위로는 수평 이상 못 봄

    // 수평(좌우) 회전 제한
    controls.minAzimuthAngle = -Math.PI * 0.2; // 왼쪽으로 45도
    controls.maxAzimuthAngle = Math.PI * 0.2;  // 오른쪽으로 45도
    // --- 여기까지 수정 ---

    // 5. 조명 설정
    const hemisphereLight = new THREE.HemisphereLight(0xffae82, 0x61c5dd, 2.5);
    hemisphereLight.position.set(0, -2, 0);
    scene.add(hemisphereLight);

        const pointLight = new THREE.PointLight(0xffae82, 100);
    pointLight.position.set(0, -3, 5);
    scene.add(pointLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(0, 0, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.blurSamples = 100;
    directionalLight.shadow.radius = 120;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;

    scene.add(directionalLight);

    const helper1 = new THREE.PointLightHelper(pointLight, 5);
    scene.add(helper1);


    const helper3 = new THREE.DirectionalLightHelper(directionalLight, 5);
    //scene.add(helper3);

    // 6. 카드 생성
    createCards();

    // 7. 이벤트 리스너 등록
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('click', onCardClick);
    document.querySelector('.back-button').addEventListener('click', goBackToHome);
    document.querySelectorAll('.image-grid img').forEach(img => {
        img.addEventListener('click', handleImageClick);
    });
}

// --- 카드 생성 함수 ---
function createCards() {
    const CARD_COUNT = 6;
    const RADIUS = 10; // 카드가 배치될 반원의 반지름
    const CARD_WIDTH = 4;
    const CARD_HEIGHT = 4 * 1.4;

    const cardGeometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT, 10, 10);
    const textureLoader = new THREE.TextureLoader();

    for (let i = 0; i < CARD_COUNT; i++) {
        // public/images 폴더에 이미지가 있다고 가정합니다.
        // 이미지가 없다면 아래 placeholder URL을 사용하세요.
        // const imageUrl = `https://placehold.co/400x550/000000/FFFFFF?text=Topic+${i+1}`;
        const imageUrl = `./images/card-${i + 1}.png`;
        const texture = textureLoader.load(imageUrl);
        const cardMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            // --- [3단계 수정] fade-out 효과를 위해 transparent 옵션 추가 ---
              roughness: 0.3,
  metalness: 0.1,
            transparent: true,
            opacity: 1,
            // --- 여기까지 수정 ---
        });

        const card = new THREE.Mesh(cardGeometry, cardMaterial);

        // 9시부터 3시 방향으로 반원(180도) 형태로 배치
        // 각도 계산 (PI = 180도)
        const angle = Math.PI * 0.9 - (i * (Math.PI * 0.8 / (CARD_COUNT - 1)));

        // 위치 계산 (삼각함수 사용)
        const x = RADIUS * Math.cos(angle);
        const z = -RADIUS * Math.sin(angle); // z축으로 약간 뒤로 배치

        card.position.set(x, -3, z);

        // 카드가 항상 카메라를 바라보도록 설정
        card.lookAt(0, -3, 0);

        card.castShadow = true;
        card.receiveShadow = true;
        // [3단계 추가] 카드에 고유 이름 부여 (클릭 시 식별용)
        card.name = `card-${i}`;

        cards.push(card); // 배열에 카드 추가
        scene.add(card);
    }
}


function onCardClick(event) {
    // 마우스 좌표를 -1 ~ 1 범위로 정규화
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Raycaster 업데이트
    raycaster.setFromCamera(mouse, camera);

    // 광선과 교차하는 객체들 확인
    const intersects = raycaster.intersectObjects(cards);

    // 만약 교차하는 카드가 있다면
    if (intersects.length > 0) {
        const clickedCard = intersects[0].object;
        animateToDetail(clickedCard);
    }
}

function animateToDetail(clickedCard) {
    // 다른 카드들과 상호작용을 막기 위해 이벤트 리스너 제거
    window.removeEventListener('click', onCardClick);
    controls.enabled = false; // OrbitControls 비활성화

    // 1. 다른 카드들과 타이틀 숨기기
    cards.forEach(card => {
        if (card !== clickedCard) {
            gsap.to(card.material, { opacity: 0, duration: 1 });
        }
    });
    gsap.to('.main-title', { opacity: 0, duration: 1, ease: 'power1.inOut' });
    gsap.to('.sub-title', { opacity: 0, duration: 1, ease: 'power1.inOut' });


    // 2. 배경색 변경
    const cardIndex = parseInt(clickedCard.name.split('-')[1]);
    const targetBackgroundColor = CARD_COLORS[cardIndex];
    gsap.to('body', { backgroundColor: targetBackgroundColor, duration: 3 });

    // 3. 카메라와 카드 애니메이션
    const targetCameraPosition = clickedCard.position.clone().normalize().multiplyScalar(5);
    const targetControlsTarget = clickedCard.position.clone();

    const tl = gsap.timeline();
    tl.to(camera.position, {
        x: targetCameraPosition.x,
        y: targetCameraPosition.y - 3,
        z: targetCameraPosition.z,
        duration: 2,
        ease: 'power2.inOut'
    })
        .to(controls.target, {
            x: targetControlsTarget.x,
            y: targetControlsTarget.y,
            z: targetControlsTarget.z,
            duration: 2,
            ease: 'power2.inOut'
        }, "<")
        .to(clickedCard.material, {
            opacity: 0,
            duration: 2,
            ease: 'power2.inOut'
        }, "<")
        .add(() => {
            gsap.to(canvasElement, {
                opacity: 0,
                duration: 0,
                onComplete: () => {
                    const detailPage = document.querySelector('#detail-page');
                    detailPage.style.backgroundColor = targetBackgroundColor;
                    detailPage.classList.add('visible');

                    const grid = document.querySelector('.image-grid');
                    imagesLoaded(grid, function () {
                        msnry = new Masonry(grid, {
                            itemSelector: '.grid-item',
                            columnWidth: '.grid-item',
                            gutter: 20, // 아이템 사이 간격
                            percentPosition: true
                        });
                    });
                }
            });
        });
}


function goBackToHome() {
    const detailPage = document.querySelector('#detail-page');
    detailPage.classList.remove('visible');

    const tl = gsap.timeline();
    tl.to(canvasElement, { opacity: 1, duration: 1 })
        .to(camera.position, {
            x: 0,
            y: 2,
            z: 25,
            duration: 1.5,
            ease: 'power2.inOut'
        }, "<")
        .to(controls.target, {
            x: 0,
            y: 0,
            z: 0,
            duration: 1.5,
            ease: 'power2.inOut'
        }, "<")
        .to('body', { backgroundColor: '#111', duration: 1.5 }, "<")
        .to('.main-title', { opacity: 1, duration: 1 }, "<")
        .to('.sub-title', { opacity: 1, duration: 1 }, "<")
        .to(cards.map(card => card.material), { opacity: 1, duration: 1.5 }, "<")
        .add(() => {
            controls.enabled = true;
            window.addEventListener('click', onCardClick);

            if (msnry) {
                msnry.destroy();
                msnry = null;
            }
        });



}

// --- 창 크기 변경 시 처리 ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- 렌더링 루프 ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function handleImageClick(event) {
    const clickedImg = event.target;
    const gridItem = clickedImg.parentElement;
    const descriptionBox = gridItem.querySelector('.description-text');
    const wasVisible = descriptionBox.classList.contains('visible');

    document.querySelectorAll('.description-text').forEach(box => {
        box.classList.remove('visible');
        box.textContent = '';
    });

    if (!wasVisible) {
        const descriptionText = clickedImg.dataset.description;
        descriptionBox.textContent = descriptionText;
        descriptionBox.classList.add('visible');
    }

    if (msnry) {
        // 부드러운 효과를 위해 약간의 딜레이 후 재정렬
        setTimeout(() => {
            msnry.layout();
        }, 50); // transition 시간과 맞춤
    }
}

init();
animate();