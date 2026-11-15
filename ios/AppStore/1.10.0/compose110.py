# 1.10.0 스토어 스크린샷 1장 추가(PO 11/15 승인) — 글 상세(방문자 시선), iPhone 6.9"·iPad 13" 2번째 자리
# 실행: /usr/bin/python3 compose110.py   (원본 raw/, 결과 out69/02-posts.png · outipad/02-posts.png)
# 원본: 가상 이름 임시 계정 하린(harin.design, 예약어)의 가상 시안 이미지 글을 데모 상대 서연으로 본 화면. 찍은 뒤 임시 계정은 지움.
# 꾸밈(배경·글자·기기 틀)은 1.6.0 compose160.py 와 같은 함수를 쓴다.
import importlib.util
import os

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('c160', os.path.join(HERE, '..', '1.6.0', 'compose160.py'))
c160 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c160)
c160.RAW = os.path.join(HERE, 'raw')

L1, L2, SUB = '작업 사진과 소식을', '링크 페이지에', '보고 마음에 들면 바로 예약해요'

if __name__ == '__main__':
    for d in ('out69', 'outipad'):
        os.makedirs(os.path.join(HERE, d), exist_ok=True)
    c160.compose(1320, 2868, 'posts', L1, L2, SUB, os.path.join(HERE, 'out69', '02-posts.png'))
    c160.compose(2064, 2752, 'posts', L1, L2, SUB, os.path.join(HERE, 'outipad', '02-posts.png'), device_w_ratio=0.84, top_ratio=0.30, ipad=True)
    print('done')
