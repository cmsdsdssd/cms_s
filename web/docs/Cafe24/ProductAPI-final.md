# Cafe24 REST API Documentation

[메뉴](#) ![Cafe24 API](../assets/images/mobile/mobile_header_logo.png)

[닫기](#) [![Logo](../assets/images/desktop/pc_gnb_logo.png)](https://developer.cafe24.com) [![Logo](../assets/images/mobile/mobile_gnb_logo.png)](https://developer.cafe24.com)

*   [Admin API](#)
*   [Front API](#)

*   *   [API Index](#api-index)
    *   [Introduction](#introduction)
        *   [Cafe24 API](#cafe24-api)
        *   [API Diagram](#api-diagram)
        *   [Request/Response Format](#request-response-format)
        *   [Method](#method)
        *   [Front API Intro](#front-api-intro)
        *   [API Status Code](#api-status-code)
        *   [How to use GET API](#how-to-use-get-api)
        *   [API Limit](#api-limit)
        *   [Versioning](#versioning)
    *   [Authentication](#authentication)
        *   [Basic Authentication](#basic-authentication)
        *   [API Limit by Authentication](#api-limit-by-authentication)
*   #### Product
    
    *   [Categories products](#categories__products)
        *   [Categories products property list](#categories__products-property-list)
        *   [Retrieve a list of products by category](#retrieve-a-list-of-products-by-category)
        *   [Retrieve a count of products by category](#retrieve-a-count-of-products-by-category)
    *   [Mains products](#mains__products)
        *   [Mains products property list](#mains__products-property-list)
        *   [Retrieve a list of products in main category](#retrieve-a-list-of-products-in-main-category)
    *   [Products](#products)
        *   [Products property list](#products-property-list)
        *   [Retrieve a list of products](#retrieve-a-list-of-products)
        *   [Retrieve a count of products](#retrieve-a-count-of-products)
        *   [Retrieve a product resource](#retrieve-a-product-resource)
    *   [Products decorationimages](#products__decorationimages)
        *   [Products decorationimages property list](#products__decorationimages-property-list)
        *   [Retrieve a list of product decoration images](#retrieve-a-list-of-product-decoration-images)
    *   [Products discountprice](#products__discountprice)
        *   [Products discountprice property list](#products__discountprice-property-list)
        *   [Retrieve a product discounted price](#retrieve-a-product-discounted-price)
    *   [Products hits](#products__hits)
        *   [Retrieve a count of product views](#retrieve-a-count-of-product-views)
    *   [Products icons](#products__icons)
        *   [Products icons property list](#products__icons-property-list)
        *   [Retrieve a list of product icons](#retrieve-a-list-of-product-icons)
    *   [Products options](#products__options)
        *   [Products options property list](#products__options-property-list)
        *   [Retrieve a list of product options](#retrieve-a-list-of-product-options)
    *   [Products variants](#products__variants)
        *   [Products variants property list](#products__variants-property-list)
        *   [Retrieve a list of product variants](#retrieve-a-list-of-product-variants)
        *   [Retrieve a product variant](#retrieve-a-product-variant)
    *   [Products variants inventories](#products__variants__inventories)
        *   [Products variants inventories property list](#products__variants__inventories-property-list)
        *   [Retrieve inventory details of a product variant](#retrieve-inventory-details-of-a-product-variant)
    *   [Productsdetail](#productsdetail)
        *   [Productsdetail property list](#productsdetail-property-list)
        *   [Retrieve the details of a product](#retrieve-the-details-of-a-product)
*   #### Category
    
    *   [Categories](#categories)
        *   [Categories property list](#categories-property-list)
        *   [Retrieve a list of product categories](#retrieve-a-list-of-product-categories)
        *   [Retrieve a count of product categories](#retrieve-a-count-of-product-categories)
        *   [Retrieve a product category](#retrieve-a-product-category)
*   #### Personal
    
    *   [Carts](#carts)
        *   [Carts property list](#carts-property-list)
        *   [Create a shopping cart](#create-a-shopping-cart)
    *   [Products carts](#products__carts)
        *   [Retrieve a count of carts containing a product](#retrieve-a-count-of-carts-containing-a-product)

  

API 버전 선택

한국어

*   [한국어](/docs/api/front)
*   [日本語](/docs/ja/api/front)
*   [English](/docs/en/api/front)

API version: 2025-12-01 (latest)

# non-print

## API Index

*   [**상품** Product](#products)
*   [**상품분류** Category](#categories)
*   [**개인화정보** Personal](#carts)

## Introduction

### Cafe24 API[](#cafe24-api)

카페24 쇼핑몰 API는 카페24 쇼핑몰에 연동하여 서비스를 제공하기 위한 앱스토어 ���점 개발사, 서드파티 솔루션 제공자 등에 제공하는 API입니다.

카페24 API는 RESTful한 아키텍쳐로서 OAuth 2.0 기반의 인증 시스템과 표준 HTTP Request Method, 리소스를 예측할 수 있는 엔드포인트 URL, HTTP 코드 기반의 에러 메시지를 제공합니다.

### API Diagram[](#api-diagram)

리소스 관계를 다이어그램으로 제공하여, 전체적인 카페24 API 체계를 확인할 수 있습니다.

[![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Front/Front_API_Diagram.png)](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Front/Front_API_Diagram.png)

### Request/Response Format[](#request-response-format)

*   API 요청과 응답은 JSON Format을 지원합니다.
    
*   개인정보 보호를 위하여 카페24 API는 HTTPS 프로토콜만 지원합니다.
    
*   Dates 속성은 [ISO\_8601 ![](../assets/images/desktop/shortcut_icon.png)](https://en.wikipedia.org/wiki/ISO_8601) Format으로 제공합니다. : YYYY-MM-DDTHH:MM:SS+09:00
    

> 요청 예제 (조회) Javascript cURL Java Python Node.js PHP Go

> 요청 예제 (등록/수정) Javascript cURL Java Python Node.js PHP Go

> 정상 응답 예제

```
{
  "resource": {
      "key": "value",
      "key": "value"
   }
}
```

> 에러 응답 예제

```
{
  "error": {
      "code": "error code",
      "message": "error message",
      "more_info": {
      }
  }
}
```

### Method[](#method)

각 리소스 별로 Create, Read, Update, Delete를 지원하며 표준 HTTP Method를 사용하여 API를 사용할 수 있습니다.

*   POST : 해당 리소스를 생성(Create)합니다.
    
*   GET : 해당 리소스의 정보를 조회(Read)합니다.
    
*   PUT : 해당 리소스를 수정(Update)합니다.
    
*   DELETE : 해당 리소스를 삭제(Delete)합니다.
    

### Front API Intro[](#front-api-intro)

Front API는 공개된 정보(상품 진열 정보) 또는 쇼핑몰 이용 고객이 자신의 정보를 조회하거나 게시물 등을 작성할 때 적합합니다. Front API는 Admin API에 비하여 일부 정보는 제한되어있습니다.

> 사용 예시

```
https://{mallid}.cafe24api.com/api/v2/sampleapi
```

### API Status Code[](#api-status-code)

| Code | 발생하는 사례 | 오류 해결 방법 | --- | --- | --- | 200 | GET 성공, PUT 성공, DELETE 성공시 |  | 201 | POST 성공시 |  | 207 | 다중 요청 등록시 상태가 객체별로 다른 경우 | 오류 상태를 객체별로 확인하여 해당 상태에 따라 대응합니다. | 400 | 서버에서 요청을 이해할 수 없음  
1) Content-Type이 잘못 지정되어있음  
2) application/type이 json이 아님 | 요청시 "Content-Type"이 application/json으로 되어있는지 확인합니다. | 400 | 요청 API URL에 한글 또는 특수문자를 인코딩하지 않고 그대로 사용한 경우 | 요청 API URL에 한글 또는 특수문자를 URL 인코딩하였는지 확인합니다. | 401 | 1) Access Token 없이 호출한 경우  
2) Access Token이 유효하지 않은 경우  
3) Access Token이 만료된 경우  
4) 알 수 없는 클라이언트일 경우 | 유효한 발급 절차에 따라 발급받은 Access Token을 사용하였는지 확인합니다. | 401 | Front API 사용시 client\_id를 미입력한 경우 | 유효한 클라이언트 ID를 사용하였는지 확인합니다. | 403 | 1) Access Token은 있으나 해당 Scope에 권한이 없음  
2) Front API에서 볼 수 있는 권한이 없을 경우 | API를 호출할 수 있는 권한이 있는지 API의 Scope 또는 쇼핑몰의 설정을 확인합니다. | 403 | https 프로토콜이 아닌 경우 | API 요청시 https 로 요청하였는지 확인합니다. | 403 | 뉴상품 쇼핑몰이 아닌 경우 | 쇼핑몰이 (뉴)상품관리로 업그레이드 되어야 사용 가능합니다. | 403 | (Admin API 호출시) 쇼핑몰에서 해당 앱이 삭제된 경우 | 쇼핑몰에 앱이 설치되었는지 확인 후 앱을 다시 설치합니다. | 403 | (Front API 호출시) 쇼핑몰에서 해당 앱이 삭제된 경우 | 쇼핑몰에 앱이 설치되었는지 확인 후 앱을 다시 설치합니다. | 403 | (Customer API 호출시) 쇼핑몰에서 해당 앱이 삭제된 경우 | 쇼핑몰에 앱이 설치되었는지 확인 후 앱을 다시 설치합니다. | 404 | 1) API URL을 잘못 호출한 경우  
2) 리소스를 찾을 수 없을 경우  
3) {#id}가 없는 경우 | 엔드포인트 URL의 오류가 있는지 API 문서를 참고하여 확인합니다. | 409 | 동일 리소스에 동일 내용을 업데이트할 경우 | 수정할 데이터를 요청해주세요. | 422 | 조회/처리 요청시 값이 정해진 스펙과 다를 경우  
1) 필수 파라메터 누락함  
2) 정해진 스펙과 다를 경우 | API 문서를 참고하여 필수 파라메터가 입력되지 않았거나 유효하지 않은 값을 입력하였는지 확인합니다. | 429 | 클라이언트의 API 요청이 Bucket을 초과한 경우 | API 최대 허용 요청 건수를 초과하지 않도록 잠시 후 다시 요청합니다. | 500 | 내부 서버 에러, 알 수 없는 에러 | 일시적으로 에러가 발생하였습니다. 잠시 후에 다시 시도합니다. | 503 | 현재 서버가 다운된 경우 | 개발자센터로 문의해주세요. | 503 | 서버가 다운된 경우. API를 사용할 수 없음. | 개발자센터로 문의해주세요. | 504 | 요청 시간이 초과된 경우(Timeout) | 일시적으로 에러가 발생하여 응답이 지연되고 있습니다. 잠시 후에 다시 시도해주세요. |

### How to use GET API[](#how-to-use-get-api)

카페24 API는 데이터를 조회하는 여러가지 방법을 제공하고 있습니다.

다음은 API 조회시 여러가지 파라메터를 사용하여 다양하게 데이터를 호출할 수 있는 방법을 설명하고 있습니다.

#### 1\. 검색조건 추가

검색조건은 엔드포인트에 파라메터를 추가하여 검색할 수 있습니다.

여러 조건을 같이 검색할 경우 "&" 구분자를 이용하여 검색 조건을 추가할 수 있습니다.

API에서 지원하는 경우, 타임존을 사용하여 날짜와 시간 검색을 할 수 있습니다.

> 검색조건 추가

```
예) 특정 브랜드 내에서 상품 판매가가 1000원 이상인 상품 조회
GET https://{mallid}.cafe24api.com/api/v2/products?brand_code=B000000A&price_min=1000

예) 상품 등록일 범위를 지정하여 상품 조회
GET https://{mallid}.cafe24api.com/api/v2/products?created_start_date=2018-01-03&created_end_date=2018-02-03

예) 상품 수정일 범위를 지정하여 상품 조회
GET https://{mallid}.cafe24api.com/api/v2/products?updated_start_date=2018-01-03T14:01:26+09:00&updated_end_date=2018-02-03T14:01:26+09:00
```

#### 2\. 콤마로 여러 건을 검색

API에서 지원하는 경우, 콤마(,)를 사용하여 여러 값을 동시에 검색할 수 있습니다. (단, 100개 항목 이하로 입력 해주세요.)

콤마(,)로 추가한 검색 조건은 OR 조건으로, 검색 조건에 해당되는 모든 값들이 검색됩니다.

> 콤마로 여러 건을 검색

```
예) 특정 상품번호를 지정하여 상품 조회
GET https://{mallid}.cafe24api.com/api/v2/products?product_no=11,12,13

예) 특정 상품번호와 상품코드를 지정하여 상품 조회
GET https://{mallid}.cafe24api.com/api/v2/products?product_no=11,12,13&product_code=P000000X,P000000W
```

#### 3\. 멀티쇼핑몰 정보 조회

특정 멀티쇼핑몰 번호를 명시하면 해당 멀티쇼핑몰의 정보를 조회할 수 있습니다.

멀티쇼핑몰 번호를 명시하지 않을 경우, 기본 쇼핑몰의 정보를 조회합니다.

> 멀티쇼핑몰 정보 조회

```
예) 특정 멀티쇼핑몰의 상품 조회
GET https://{mallid}.cafe24api.com/api/v2/products?shop_no=2
```

#### 4\. 상세 조회와 단건 조회

리소스의 ID를 명시하여 상세 조회를 할 수 있습니다.

상세 조회는 리소스 하나만 조회할 수 있지만, 목록 조회보다 더 많은 항목이 반환됩니다.

> 상세 조회와 단건 조회

```
예) 특정 상품번호를 지정하여 상품 상세 조회
GET https://{mallid}.cafe24api.com/api/v2/products/128


예) 특정 상품번호를 지정하여 상품 단건 조회
GET https://{mallid}.cafe24api.com/api/v2/products?product_no=128
```

#### 5\. Pagination

조회 결과가 많을 경우, 정해진 'limit' 기본 값만큼 결과가 조회됩니다.

'limit' 파라메터를 이용하여 조회 건수를 확장할 수 있으며, API마다 정의된 최대 값만큼만 확장할 수 있습니다.

'limit' 최대 값으로 모든 데이터를 조회할 수 없는 경우, 'offset' 파라메터를 사용할 수 있습니다.

> Pagination

```
예 ) 상품 100개 조회
GET https://{mallid}.cafe24api.com/api/v2/products?limit=100


예) 201번째 상품부터 300번째 상품까지 조회
GET https://{mallid}.cafe24api.com/api/v2/products?limit=100&offset=200
```

#### 6\. 특정 항목 조회

특정한 값들만 조회하고 싶을 때는 'fields' 파라메터를 사용하여 조회할 수 있습니다.

> 특정 항목 조회

```
예) 상품명과 상품번호 항목만 조회
GET https://{mallid}.cafe24api.com/api/v2/products?fields=product_name,product_no
```

#### 7\. 하위 리소스 조회

API에서 지원하는 경우, 'embed' 파라메터를 사용하여 하위 리소스의 데이터를 같이 조회할 수 있습니다.

> 하위 리소스 조회

```
예) 상품 조회시 품목과 재고 데이터를 함께 조회
GET https://{mallid}.cafe24api.com/api/v2/products/570?embed=variants,inventories
```

### API Limit[](#api-limit)

카페24 API는 안정적인 응답 속도와 플랫폼 전체의 가용성을 보장하기 위해, 요청 수 제한 정책과 사용량 제한 정책을 병행 적용합니다.

#### 요청 수 제한

카페24 API는 "Leaky Bucket" 알고리즘으로 작동합니다. Leaky Bucket 알고리즘은 성능을 위해 비정상적으로 많은 API 요청만 제한되고 일상적인 API 요청은 별다른 제약 없이 사용할 수 있는 효과가 있습니다.제한되고 일상적인 API 요청은 별다른 제약 없이 사용할 수 있는 효과가 있습니다.

카페24 API는 API 요청을 Bucket에 쌓아둡니다. Bucket은 쇼핑몰 당 "호���건 수 제한"만큼 가득차면 API 호출이 제한됩니다. Bucket은 1초에 2회씩 감소하며, 감소한만큼 다시 API 호출을 할 수 있습니다.

*   만약 앱이 1초에 2회씩 API를 호출한다면 API 호출을 별다른 제약 없이 계속 사용할 수 있습니다.
    
*   순간적으로 1초 이내에 "호출건 수 제한" 이상의 콜이 발생한다면 429 에러(Too Many Request)를 반환합니다.
    
*   Bucket 이내의 호출이라도 해당 쇼핑몰에서 동일 IP로 초당 10회 이상의 호출이 발생할 경우 비정상적인 호출로 판단될 수 있습니다.
    

Header에 `X-Api-Call-Limit`을 확인하면 429 에러를 피할 수 있습니다. 해당 쇼핑몰에서 얼마나 API를 호출했는지, 그리고 Bucket 여유량은 얼마나 남았는지를 확인할 수 있습니다.

```
X-Api-Call-Limit : 1/40
```

#### 사용량 제한

카페24 API는 단순 호출 횟수 제한 외에도 사용량 기반 제한 정책을 적용합니다. API 응답에는 Usage와 Remain 관련 Header가 함께 포함되며, 이를 통해 현재 사용량과 재호출 가능 시간을 확인할 수 있습니다.

*   `X-Cafe24-Call-Usage` : 호출 횟수 한도 대비 사용률(%)
    
*   `X-Cafe24-Call-Remain` : 호출 재개 가능까지 남은 시간(초)
    
*   `X-Cafe24-Time-Usage` : 처리 시간 한도 대비 사용률(%)
    
*   `X-Cafe24-Time-Remain` : 처리 시간 재개 가능까지 남은 시간(초)
    

Remain 항목은 Usage 값이 100% 이상, 즉 자원이 모두 소진된 상태에서만 응답에 포함됩니다.

정상 사용 구간에서는 Remain 값이 내려오지 않으며, 이는 아직 제한에 도달하지 않았음을 의미합니다.

제한을 초과하면 해당 클라이언트의 API 호출은 일시적으로 차단되며, 차단된 상태에서 계속 호출을 시도할 경우 Usage 값이 100%를 초과하여 재호출 가능까지 남은 시간은 더 길어질 수 있습니다.

따라서 서비스 영향 최소화를 위해 Header 값을 반드시 확인하고, 호출 로직을 조정하는 것이 필요합니다.

```
X-Cafe24-Call-Usage : 120.04
X-Cafe24-Call-Remain : 32
X-Cafe24-Time-Usage : 100.5
X-Cafe24-Time-Remain : 7
```

### Versioning[](#versioning)

Version 2025-12-01 (latest) 이전 버전과 호환되지 않은 변경사항에 대해 날짜로 버전을 제공합니다.

custom headers "X-Cafe24-Api-Version"를 통해 원하시는 버전을 지정할 수 있으며 버전을 지정하지 않을경우 개발정보의 앱 버전으로 동작합니다.

앱 버전은 아래 경로를 통해 확인 및 변경이 가능합니다.

*   개발자센터(로그인) > Apps > 개발정보 > 인증정보 내 버전관리

버전의 만료 기간은 최신 버전 릴리즈가 출시된 시점부터 최대 1년입니다.

해당 버전이 만료된 이후에는 만료되지 않은 버전 중 가장 오래된 버전으로 동작합니다.

> 예시 코드 (요청) Javascript cURL Java Python Node.js PHP Go

## Authentication

### Basic Authentication[](#basic-authentication)

Front API는 HTTP Basic 인증 방식을 지원합니다. 인증된 요청은 클라이언트별 설정에 따른 API 호출 제한이 적용되며, 인증하지 않은 요청은 제한된 호출 한도가 적용됩니다.

Basic 인증 데이터는 client\_id와 front\_api\_key를 콜론(:)으로 연결한 후 Base64로 인코딩하여 생성합니다.

*   {client\_id} : 개발자 센터에서 생성한 앱의 client\_id를 입력합니다.
    
*   {front\_api\_key} : 개발자 센터에서 생성한 앱의 front\_api\_key를 입력합니다.
    

인증 정보가 유효하지 않은 경우 401 Unauthorized 응답이 반환됩니다.

> Base64 인코딩 생성 방법

```
1. client_id와 front_api_key를 콜론(:)으로 연결합니다.
   {client_id}:{front_api_key}

2. 연결된 문자열을 Base64로 인코딩합니다.
   Base64({client_id}:{front_api_key})

3. 인코딩된 값을 Authorization 헤더에 설정합니다.
   Authorization: Basic {Base64로 인코딩된 값}
```

> 예시

```
Authorization: Basic {base64_encode({client_id}:{front_api_key})}
```

> 예시 코드 (요청)

```
curl -X GET \
  'https://{mallid}.cafe24api.com/api/v2/products/count' \
  -H 'Authorization: Basic {base64_encode({client_id}:{front_api_key})}' \
  -H 'Content-Type: application/json' \
  -H 'X-Cafe24-Client-Id: {client_id}'
```

> 예시 코드 (응답)

```
HTTP/1.1 200 OK
{
    "count": 85
}
```

### API Limit by Authentication[](#api-limit-by-authentication)

Front API는 인증 여부에 따라 API 호출 제한이 다르게 적용됩니다.

*   인증된 요청 : 클라이언트별 설정 또는 시스템 기본값에 따른 일반적인 호출 제한이 적용됩니다.
    
*   인증되지 않은 요청 : 제한된 호출 한도가 적용됩니다.
    

안정적인 서비스 운영을 위해 Basic 인증을 사용하는 것을 권장합니다.

# Product

## Categories products

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Categories%20products.png)  
  
카테고리 상품(Categories products)은 카테고리의 상품의 표시 순서, 고정 여부, 진열 영역 등을 조회, 수정할 수 있는 관계형 리소스입니다.

> Endpoints

```
GET /api/v2/categories/{category_no}/products
GET /api/v2/categories/{category_no}/products/count
```

#### \[더보기 상세 내용\]

### Categories products property list[](#categories__products-property-list)

| **Attribute** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호
| product\_no | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.
| product\_name | 

상품명
| manufacturer\_name | 

제조사
| origin\_place\_value | 

원산지
| retail\_price | 

상품 소비자가
| price | 

판매가
| interest\_free\_period | 

무이자할부 기간
| eng\_product\_name | 

영문 상품명
| custom\_product\_code | 

자체상품 코드
| point\_amount | 

적립금
| brand\_name | 

브랜드 명
| model\_name | 

모델명
| price\_excluding\_tax | 

상품 판매가
| tax | 

세액
| product\_code | 

상품코드
| simple\_description | 

상품 간략 설명
| summary\_description | 

상품요약설명
| supplier\_name | 

공급사명
| made\_date | 

제조일자
| review\_count | 

사용후기 갯수
| expiration\_date | 

유효기간
| coupon\_discounted\_price | 

쿠폰적용가
| trend\_name | 

트렌드 명
| shipping\_scope | 

배송정보
| shipping\_fee\_type | 

배송비 타입

T : 배송비 무료  
R : 고정배송비 사용  
M : 구매 금액에 따른 부과  
D : 구매 금액별 차등 배송료 사용  
W : 상품 무게별 차등 배송료 사용  
C : 상품 수량별 차등 배송료 사용  
N : 상품 수량에 비례하여 배송료 부과
| shipping\_rates | 

구간별 배송비
| shipping\_fee | 

배송비
| discount\_price | 

할인판매가
| optimum\_discount\_price | 

최적할인가
| shipping\_method | 

배송방법
| promotion\_period | 

할인 기간
| color | 

상품색상
| translated\_additional\_description | 

상품 추가설명 번역정보
| stock\_quantity | 

재고수량
| question\_count | 

상품문의(수)
| product\_article\_count | 

상품자유게시판(수)

### Retrieve a list of products by category [](#retrieve-a-list-of-products-by-category)cafe24 youtube

GET /api/v2/categories/{category\_no}/products

###### GET

특정 카테고리에 배정된 상품을 목록으로 조회할 수 있습니다.  
상품은 동시에 여러 카테고리에 배정될 수 있습니다.  
상품번호, 표시 순서, 판매 여부 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | mobile | 
모바일 설정값 조회 여부

T : 사용함  
F : 사용안함
| shop\_no | 

멀티쇼핑몰 번호

DEFAULT 1
| **category\_no**  
**Required** | 

분류 번호
| **display\_group**  
**Required**  

_최소: \[1\]~최대: \[3\]_

 | 

상세 상품분류

1 : 일반상품  
2 : 추천상품  
3 : 신상품
| limit  

_최소: \[1\]~최대: \[200\]_

 | 

조회결과 최대건수

DEFAULT 100
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

Retrieve a list of products by category

*   [Retrieve a list of products by category](#none)
*   [Retrieve mobile disaplayed products of the category](#none)
*   [Retrieve products of the category using limit and offset parameter](#none)
*   [Retrieve product\_no and product name of products using fields parameter](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of products by category [](#retrieve-a-count-of-products-by-category)cafe24 youtube

GET /api/v2/categories/{category\_no}/products/count

###### GET

특정 카테고리에 배정된 상품의 수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1
| **category\_no**  
**Required** | 

분류 번호
| **display\_group**  
**Required**  

_최소: \[1\]~최대: \[3\]_

 | 

상세 상품분류

1 : 일반상품  
2 : 추천상품  
3 : 신상품

Retrieve a count of products by category

*   [Retrieve a count of products by category](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Mains products

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Front/Mains_products.png)  
  
메인분류 상품(Mains products)은 상품 메인진열의 순서에 관한 메인분류의 관계형 리소스입니다

> Endpoints

```
GET /api/v2/mains/{display_group}/products
```

#### \[더보기 상세 내용\]

### Mains products property list[](#mains__products-property-list)

| **Attribute** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.
| product\_no | 

상품번호
| product\_name | 

상품명
| manufacturer\_name | 

제조사
| origin\_place\_value | 

원산지
| retail\_price | 

상품 소비자가
| price | 

판매가
| interest\_free\_period | 

무이자할부 기간
| eng\_product\_name | 

영문 상품명
| custom\_product\_code | 

자체상품 코드
| point\_amount | 

적립금
| brand\_name | 

브랜드 명
| model\_name | 

모델명
| price\_excluding\_tax | 

상품 판매가
| tax | 

세액
| product\_code | 

상품코드
| simple\_description | 

상품 간략 설명
| summary\_description | 

상품요약설명
| supplier\_name | 

공급사명
| made\_date | 

제조일자
| review\_count | 

사용후기 갯수
| expiration\_date | 

유효기간
| coupon\_discounted\_price | 

쿠폰적용가
| trend\_name | 

트렌드 명
| shipping\_scope | 

배송정보
| shipping\_fee\_type | 

배송비 타입

T : 배송비 무료  
R : 고정배송비 사용  
M : 구매 금액에 따른 부과  
D : 구매 금액별 차등 배송료 사용  
W : 상품 무게별 차등 배송료 사용  
C : 상품 수량별 차등 배송료 사용  
N : 상품 수량에 비례하여 배송료 부과
| shipping\_rates | 

구간별 배송비
| shipping\_fee | 

배송비
| discount\_price | 

할인판매가
| optimum\_discount\_price | 

최적할인가
| shipping\_method | 

배송방법
| promotion\_period | 

할인 기간
| color | 

상품색상
| translated\_additional\_description | 

상품 추가설명 번역정보
| stock\_quantity | 

재고수량
| question\_count | 

상품문의(수)
| product\_article\_count | 

상품자유게시판(수)

### Retrieve a list of products in main category [](#retrieve-a-list-of-products-in-main-category)cafe24 youtube

GET /api/v2/mains/{display\_group}/products

###### GET

특정 메인분류에 배정된 상품을 목록으로 조회할 수 있습니다.  
상품번호, 상품명, 고정 여부 등을 조회할 수 있습니다.  
상품은 동시에 여러 메인분류에 배정될 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | mobile | 
모바일 설정값 조회 여부

T : 사용함  
F : 사용안함
| shop\_no | 

멀티쇼핑몰 번호

DEFAULT 1
| **display\_group**  
**Required** | 

메인분류 번호
| limit  

_최소: \[1\]~최대: \[200\]_

 | 

조회결과 최대건수

DEFAULT 100
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

Retrieve a list of products in main category

*   [Retrieve a list of products in main category](#none)
*   [Retrieve mobile disaplayed products of the main category](#none)
*   [Retrieve products of the main category using limit and offset parameter](#none)
*   [Retrieve products of the main category using fields parameter](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Front/Products.png)  
  
상품(Products)은 쇼핑몰에서 거래되는 제품의 기본 단위입니다.  
컬러, 사이즈 같은 옵션이 있을 경우 각각의 옵션이 상품 하위의 품목으로 생성될 수 있습니다.  
상품은 상품명, 판매가, 요약설명, 상품 검색어 등의 정보를 포함하고 있습니다.  
상품은 품목, 상품 메모, SEO 등 여러 하위 리소스들을 갖고 있습니다.

> Endpoints

```
GET /api/v2/products
GET /api/v2/products/count
GET /api/v2/products/{product_no}
```

#### \[더보기 상세 내용\]

### Products property list[](#products-property-list)

| **Attribute** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.
| product\_no | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.
| product\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

상품코드

시스템이 상품에 부여한 코드. 해당 쇼핑몰 내에서 상품코드는 중복되지 않음.
| custom\_product\_code  

_최대글자수 : \[40자\]_

 | 

자체상품 코드

사용자가 상품에 부여 가능한 코드. 재고 관리등의 이유로 자체적으로 상품을 관리 하고 있는 경우 사용함.
| product\_name  

_최대글자수 : \[250자\]_

 | 

상품명

상품의 이름. 상품명은 상품을 구분하는 가장 기초적인 정보이며 검색 정보가 된다. HTML을 사용하여 입력이 가능하다.
| eng\_product\_name  

_최대글자수 : \[250자\]_

 | 

영문 상품명

상품의 영문 이름. 해외 배송 등에 사용 가능함.
| model\_name  

_최대글자수 : \[100자\]_

 | 

모델명

상품의 모델명.
| price\_excluding\_tax | 

상품가(세금 제외)
| price | 

상품 판매가

상품의 판매 가격. 쿠폰 및 혜택을 적용하기 전의 가격.  
상품 등록시엔 모든 멀티 쇼핑몰에 동일한 가격으로 등록하며, 멀티쇼핑몰별로 다른 가격을 입력하고자 할 경우 상품 수정을 통해 가격을 다르게 입력할 수 있다.  
※ 판매가 = \[ 공급가 + (공급가 \* 마진율) + 추가금액 \]
| retail\_price | 

상품 소비자가

시중에 판매되는 소비자 가격. 쇼핑몰의 가격을 강조하기 위한 비교 목적으로 사용함.
| display | 

진열상태

상품을 쇼핑몰에 진열할지 여부. 상품을 쇼핑몰에 진열할 경우 설정한 상품분류와 메인화면에 표시된다. 상품이 쇼핑몰에 진열되어 있지 않으면 쇼핑몰 화면에 표시되지 않아 접근할 수 없으며 상품을 구매할 수 없다.

T : 진열함  
F : 진열안함
| selling | 

판매상태

상품을 쇼핑몰에 판매할지 여부. 상품을 진열한 상태로 판매를 중지할 경우 상품은 쇼핑몰에 표시되지만 "품절"로 표시되어 상품을 구매할 수 없다. 상품이 "진열안함"일 경우 "판매함" 상태여도 상품에 접근할 수 없기 때문에 구매할 수 없다.

T : 판매함  
F : 판매안함
| product\_used\_month  

_최대값: \[2147483647\]_

 | 

중고상품 사용 개월
| summary\_description  

_최대글자수 : \[255자\]_

 | 

상품요약설명

상품에 대한 요약 정보. 상품 진열 화면에서 노출 가능한 설명. HTML을 사용하여 입력이 가능하다.  
\[쇼핑몰 설정 > 상품 설정 > '상품 보기 설정 > 상품 정보 표시 설정'\]에서 노출되도록 설정 가능하다.
| product\_tag | 

상품 검색어

쇼핑 큐레이션 사용 시 - 배열 최대사이즈 : \[100\]
| tax\_calculation | 

LIBSPECDATATAX.CALCULATION.TYPES

A : 자동 계산  
M : 수동 계산
| price\_content  

_최대글자수 : \[20자\]_

 | 

판매가 대체문구

상품의 가격 대신 표시되는 문구. 품절이나 상품이 일시적으로 판매 불가할 때 사용.
| buy\_limit\_by\_product | 

구매제한 개별 설정여부

T : 사용함  
F : 사용안함
| buy\_limit\_type | 

구매제한

해당 상품을 구매할 수 있는 회원 정보 표시.

N : 회원만 구매하며  
구매버튼 감추기  
M : 회원만 구매하며  
구매버튼 보이기  
F : 구매제한 안함  
O : 지정된 회원만 구매하며 구매버튼 감추기  
D : 지정된 회원만 구매하며 구매버튼 보이기
| buy\_group\_list | 

구매가능 회원 등급
| buy\_member\_id\_list | 

구매가능 회원아이디
| repurchase\_restriction | 

재구매 제한

T : 재구매 불가  
F : 제한안함
| single\_purchase\_restriction | 

단독구매 제한

T : 단독구매 불가  
F : 제한안함
| single\_purchase | 

LIBSPECDATASETTING.EXCLUSIVE.PURCHASES

LIBSPECDATAEXCLUSIVE.PURCHASES.002
| buy\_unit\_type | 

구매단위 타입

해당 상품의 구매 단위를 1개 이상으로 설정한 경우 해당 구매 단위를 품목 단위로 할 것인지, 상품 단위로 할 것인지에 대한 설정

P : 상품 기준  
O : 품목 기준
| buy\_unit | 

구매단위

구매할 수 있는 최소한의 단위 표시.  
예) 구매 주문단위가 세 개일 경우, 3개, 6개, 9개 단위로 구매 가능함.
| order\_quantity\_limit\_type | 

주문수량 제한 기준

해당 상품의 주문 수량 제한시 제한 기준을 품목 단위로 할 것인지, 상품 단위로 할 것인지에 대한 설정

P : 상품 기준  
O : 품목 기준
| minimum\_quantity  

_최대값: \[2147483647\]_

 | 

최소 주문수량

주문 가능한 최소한의 주문 수량. 주문 수량 미만으로 구매 할 수 없음.
| maximum\_quantity  

_최대값: \[2147483647\]_

 | 

최대 주문수량

주문 가능한 최대한의 주문 수량. 주문 수량을 초과하여 구매 할 수 없음.  
  
최대 주문수량이 "제한없음"일 경우 "0"으로 표시된다.
| points\_by\_product | 

적립금 개별설정 사용여부

F : 기본설정 사용  
T : 개별설정
| points\_setting\_by\_payment | 

결제방식별 적립금 설정 여부

B : 기본 적립금설정 사용  
C : 결제방식에 따른 적립
| points\_amount | 

적립금 설정 정보
| adult\_certification | 

성인인증

성인인증이 필요한 상품인지 여부. 성인인증이 필요한 상품인 구매를 위해서는 본인인증을 거쳐야함.

T : 사용함  
F : 사용안함
| detail\_image | 

상세이미지

상품 상세 화면에 표시되는 상품 이미지.
| list\_image | 

목록이미지

상품 분류 화면, 메인 화면, 상품 검색 화면에 표시되는 상품의 목록 이미지.
| tiny\_image | 

작은목록이미지

최근 본 상품 영역에 표시되는 상품의 목록 이미지.
| small\_image | 

축소이미지

상품 상세 화면 하단에 표시되는 상품 목록 이미지.
| use\_naverpay | 

네이버페이 사용여부

T : 사용함  
F : 사용안함
| naverpay\_type | 

네이버페이 판매타입

C : 네이버페이 + 쇼핑몰 동시판매 상품  
O : 네이버페이 전용상품
| manufacturer\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

제조사 코드

제조사를 등록하면 자동으로 생성되는 코드로 상품에 특정 제조사를 지정할 때 사용.  
  
미입력시 자체제작(M0000000) 사용
| trend\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

트렌드 코드

트렌드를 등록하면 자동으로 생성되는 코드로 상품에 특정 트렌드를 지정할 때 사용.  
  
미입력시 기본트렌드(T0000000) 사용
| brand\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

브랜드 코드

브랜드를 등록하면 자동으로 생성되는 코드로 상품에 특정 브랜드를 지정할 때 사용.  
  
미입력시 자체브랜드(B0000000) 사용
| made\_date | 

제조일자

상품을 제조한 제조일자.
| expiration\_date  

_배열 최대사이즈: \[2\]_

 | 

유효기간

상품을 정상적으로 사용할 수 있는 기간. 상품권이나 티켓 같은 무형 상품, 식품이나 화장품 같은 유형 상품의 유효기간을 표시.  
  
주로 상품권이나 티켓 같은 무형 상품에 사용되며, 해당 무형 상품의 유효기간을 표시.
| origin\_classification | 

원산지 국내/국외/기타

F : 국내  
T : 국외  
E : 기타
| origin\_place\_no | 

원산지 번호

원산지 번호를 List all Origin API를 통해 원산지를 조회하여 입력  
origin\_classification이 F(국내)인 경우, 해외 여부(foreign)가 "F"인 원산지만 입력 가능함.  
origin\_classification이 T(해외)인 경우, 해외 여부(foreign)가 "T"인 원산지만 입력 가능함.
| origin\_place\_value  

_최대글자수 : \[30자\]_

 | 

원산지기타정보

원산지가 "기타(1800)"일 경우 원산지로 입력 가능한 정보.
| made\_in\_code | 

원산지 국가코드
| icon\_show\_period | 

아이콘 노출 기간

상품에 설정한 아이콘이 노출되는 기간.
| icon  

_배열 최대사이즈: \[5\]_

 | 

아이콘

상품에 표시되는 아이콘. 상품 판매를 강조하기 위한 목적으로 사용이 가능함.
| product\_material | 

상품소재

상품의 소재. 복합 소재일 경우 상품의 소재와 함유랑을 함께 입력해야함. (예 : 면 80%, 레이온 20%)
| list\_icon | 

추천 / 품절 / 신상품 아이콘 노출 여부

추천, 품절, 신상품 아이콘을 목록에서 표시하는지 여부  
  
※ 품절 아이콘  
  
● 상품이 품절 상태임을 알려주는 아이콘  
● 재고관리 및 품절 기능을 사용하는 상품에 대해 재고가 없을 경우 표시  
  
※ 추천, 신상품 아이콘  
  
● 상품분류나 메인화면의 추천상품, 신상품 영역에 진열된 상품인 경우, 설정에 따라 해당 아이콘을 표시함  
  
※ 아이콘 노출 여부 설정위치 : \[쇼핑몰 설정 > 상품 설정 > '상품 정책 설정 > 상품 관련 설정 > 상품 아이콘 설정'\]
| approve\_status | 

승인요청 결과

N : 승인요청 (신규상품)  
E : 승인요청 (상품수정)  
C : 승인완료  
R : 승인거절  
I : 검수진행중  
Empty Value : 요청된적 없음
| sold\_out | 

품절여부

해당 상품이 품절되었는지 여부. 해당 상품이 재고를 사용하고 있고 모든 품목의 재고가 0이 되면 품절로 표시된다.

T : 품절  
F : 품절아님
| discountprice | 

상품 할인판매가 리소스
| decorationimages | 

꾸미기 이미지 리소스
| benefits | 

혜택 리소스
| options | 

상품 옵션 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.
| variants | 

품목 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.
| hits | 

상품 조회수 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.
| clearance\_category\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

해외통관코드

[clearance\_category\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/clearance_category_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)
| additionalimages | 

추가 이미지 리소스
| exposure\_limit\_type | 

표시제한 범위

A : 모두에게 표시  
M : 회원에게만 표시
| exposure\_group\_list | 

표시대상 회원 등급
| set\_product\_type | 

세트상품 타입

C : 일반세트  
S : 분리세트
| use\_kakaopay | 

LIBSPECDATAWHETHER.KAKAO.PAY.IS.USED

T : 사용함  
F : 사용안함
| shipping\_fee\_type | 

배송비 타입

(개별배송비를 사용할 경우) 상품의 배송비 타입.  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.

T : 배송비 무료  
R : 고정배송비 사용  
M : 구매 금액에 따른 부과  
D : 구매 금액별 차등 배송료 사용  
W : 상품 무게별 차등 배송료 사용  
C : 상품 수량별 차등 배송료 사용  
N : 상품 수량에 비례하여 배송료 부과
| main | 

메인진열

상품을 "추천상품", "신상품"과 같은 메인진열에 진열할 경우, 메인 진열 번호를 표시한다.
| channeldiscountprices | 

상품 할인판매가 리소스
| market\_sync | 

마켓 연동 여부

T : 사용함  
F : 사용안함
| cultural\_tax\_deduction | 

문화비 소득공제
| size\_guide | 

LIBSPECDATASIZE.GUIDE
| memos | 

메모 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.
| seo | 

상품 Seo 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.
| category | 

분류 번호

해당 상품이 진열되어있는 상품 분류.
| project\_no | 

기획전 번호
| description | 

상품상세설명

상품에 보다 상세한 정보가 포함되어있는 설명. HTML을 사용하여 입력이 가능하다.
| mobile\_description | 

모바일 상품 상세설명

입력시 모바일 쇼핑몰에서 상품상세설명 대신 모바일 상품 상세 설명을 대신 표시함.
| separated\_mobile\_description | 

모바일 별도 등록

T : 직접등록  
F : 상품 상세설명 동일
| payment\_info | 

상품결제안내

상품의 결제 방법에 대한 안내 문구. HTML을 사용하여 입력이 가능하다.
| shipping\_info | 

상품배송안내

상품의 배송 방법에 대한 안내 문구. HTML을 사용하여 입력이 가능하다.
| exchange\_info | 

교환/반품안내

상품의 교환/반품 방법에 대한 안내 문구. HTML을 사용하여 입력이 가능하다.
| service\_info | 

서비스문의/안내

제품의 사후 고객 서비스 방법 대한 안내 문구. HTML을 사용하여 입력이 가능하다.
| product\_tax\_type\_text | 

부가세 표시 문구

\[쇼핑몰 설정 > 상품 설정 > '상품 보기 설정 > 상품 정보 표시 설정 > 추가설정 > 판매가 부가세 표시문구'\]에서 설정한 문구 표시  
tax\_calculation이 A(자동계산)일 경우 null로 반환됨.
| simple\_description | 

상품 간략 설명

상품에 대한 간략한 정보. 상품 진열 화면에서 노출 가능한 설명. HTML을 사용하여 입력이 가능하다.  
\[쇼핑몰 설정 > 상품 설정 > '상품 보기 설정 > 상품 정보 표시 설정'\]에서 노출되도록 설정 가능하다.
| tags | 

상품 태그 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.
| has\_option | 

옵션 사용여부

해당 상품이 옵션을 갖고 있는지에 대한 여부. 옵션을 갖고 있는 상품은 사이즈나 색상과 같은 다양한 선택지를 제공한다.

T : 옵션사용함  
F : 옵션 사용안함
| soldout\_message  

_최대글자수 : \[250자\]_

 | 

LIBSPECDATAOUT.OF.STOCK.MESSAGE
| option\_type | 

옵션 구성방식

옵션을 사용할 경우, 옵션의 유형 표시  
  
● 조합 일체선택형 : 하나의 셀렉스박스(버튼 이나 라디오버튼)에 모든 옵션이 조합되어 표시됨  
● 조합 분리선택형 : 옵션을 각각의 셀렉스박스(버튼 이나 라디오버튼)로 선택할 수 있으며 옵션명을 기준으로 옵션값을 조합할 수 있음  
● 상품 연동형 : 옵션표시방식은 조합형과 유사하지만 필수옵션과 선택옵션을 선택할 수 있음. 옵션의 조합을 제한 없이 생성할 수 있음.  
● 독립 선택형 : 독립적인 조건 여러개를 각각 선택할 수 있는 옵션으로 옵션 값이 조합되지 않고 각각의 품목으로 생성됨.

C : 조합 일체선택형  
S : 조합 분리선택형  
E : 상품 연동형  
F : 독립 선택형
| shipping\_calculation | 

LIBSPECDATASHIPPING.CALCULATION.TYPE

A : 자동 계산  
M : 수동 계산
| shipping\_method | 

배송방법

(개별배송비를 사용할 경우) 배송 수단 및 방법  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.

01 : 택배  
02 : 빠른등기  
03 : 일반등기  
04 : 직접배송  
05 : 퀵배송  
06 : 기타  
07 : 화물배송  
08 : 매장직접수령  
09 : 배송필요 없음
| prepaid\_shipping\_fee | 

배송비 선결제 설정

shipping\_calculation이 A(자동계산)일 경우 null로 반환.

C : 착불  
P : 선결제  
B : 선결제/착불
| shipping\_period | 

배송기간

(개별배송비를 사용할 경우) 상품 배송시 평균적으로 소요되는 배송 기간.  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.
| shipping\_scope | 

배송정보

국내에만 배송이 가능한 상품인지 해외에도 배송이 가능한 상품인지 표시. \[쇼핑몰 설정 > 배송 설정 > '배송 정책 설정 > 배송비 설정 > 개별배송비 설정'\] 에서 상품별 개별배송료 설정이 사용안함인 경우 설정 불가.  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.

A : 국내배송  
C : 해외배송  
B : 국내/해외배송
| shipping\_area  

_최대글자수 : \[255자\]_

 | 

배송지역

(개별배송비를 사용할 경우) 상품을 배송할 수 있는 지역.  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.
| shipping\_rates | 

구간별 배송비

개별배송비를 사용할 경우 상품의 개별 배송비.  
  
shipping\_fee\_type이 R, N일 경우 배열 안에 shipping\_fee를 정의하여 배송비를 설정할 수 있다.  
  
shipping\_fee\_type이 M, D, W, C일 경우 배열 안에 다음과 같이 정의하여 배송비 구간을 설정할 수 있다.  
shipping\_rates\_min : 배송비 구간 시작 기준  
shipping\_rates\_max : 배송비 구간 종료 기준  
shipping\_fee : 배송비  
  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.
| product\_shipping\_type | 

LIBSPECDATAPRODUCT.DELIVERY.TYPE

D : 사입배송  
C : 직접배송  
E : 기타(창고/위탁)
| origin\_place\_code | 

원산지 코드

상품의 원산지 코드.
| additional\_information | 

추가항목

\[쇼핑몰 설정 > 상품 설정 > '상품 보기 설정 > 상품 정보 표시 설정'\]에서 추가한 추가항목.  
  
기본적인 상품 정보 외에 추가로 표시항 항목이 있을 때 추가하여 사용함.
| relational\_product | 

관련상품

해당 상품과 비슷한 상품 혹은 대체 가능한 상품. 관련 상품 등록시 해당 상품의 상세페이지 하단에 노출된다.
| select\_one\_by\_option | 

옵션별로 한 개씩 선택 (독립형 옵션)

독립형 옵션을 사용할 경우, 하나의 옵션을 여러개 중복하여 선택할 수 없고 한개씩만 선택 가능함.

T : 사용함  
F : 사용안함
| custom\_properties | 

상품 Seo 리소스

### Retrieve a list of products [](#retrieve-a-list-of-products)cafe24 youtube

GET /api/v2/products

###### GET

쇼핑몰에 생성되어 있는 상품을 목록으로 조회할 수 있습니다.  
상품코드, 상품명, 판매가 등을 조회할 수 있습니다.  
상품이 5,000개가 넘을 경우에는 offset 으로는 조회할 수 없으므로 since\_product\_no 파라메터를 활용해주시면 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | channeldiscountprices  
**embed** | 
상품 할인판매가 리소스
| discountprice  
**embed** | 

상품 할인판매가 리소스
| decorationimages  
**embed** | 

꾸미기 이미지 리소스
| benefits  
**embed** | 

혜택 리소스
| options  
**embed** | 

상품 옵션 리소스
| variants  
**embed** | 

품목 리소스

상품당 품목정보를 100개까지 조회할 수 있음.  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.
| additionalimages  
**embed** | 

추가 이미지 리소스
| hits  
**embed** | 

상품 조회수 리소스
| shop\_no | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1
| product\_no | 

상품번호

조회하고자 하는 상품의 번호

,(콤마)로 여러 건을 검색할 수 있다.
| selling | 

판매상태

판매중이거나 판매안함 상태의 상품 검색.
| product\_name | 

상품명

검색어를 상품명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.
| product\_code | 

상품코드

검색어를 상품코드에 포함하고 있는 상품 검색(대소문자 구분 필요)

,(콤마)로 여러 건을 검색할 수 있다.
| brand\_code | 

브랜드 코드

브랜드 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.
| manufacturer\_code | 

제조사 코드

제조사 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.
| supplier\_code | 

공급사 코드

공급사 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.
| trend\_code | 

트렌드 코드

트렌드 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.
| product\_tag | 

상품 검색어

검색어를 상품 검색어 또는 태그에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.
| custom\_product\_code | 

자체상품 코드

검색어를 자체상품코드에 포함하고 있는 상품 검색(대소문자 구분 필요)

,(콤마)로 여러 건을 검색할 수 있다.
| custom\_variant\_code | 

자체 품목 코드

,(콤마)로 여러 건을 검색할 수 있다.
| price\_min | 

상품 판매가 검색 최소값

판매가가 해당 범위 이상인 상품 검색
| price\_max | 

상품 판매가 검색 최대값

판매가가 해당 범위 이하인 상품 검색
| retail\_price\_min  

_최소값: \[0\]_  
_최대값: \[2147483647\]_

 | 

상품 소비자가 검색 최소값

소비자가가 해당 범위 이상인 상품 검색
| retail\_price\_max  

_최소값: \[0\]_  
_최대값: \[2147483647\]_

 | 

상품 소비자가 검색 최대값

소비자가가 해당 범위 이하인 상품 검색
| supply\_price\_min | 

상품 공급가 검색 최소값

공급가가 해당 범위 이하인 상품 검색
| supply\_price\_max | 

상품 공급가 검색 최대값

공급가가 해당 범위 이상인 상품 검색
| created\_start\_date | 

상품 등록일 검색 시작일

상품 등록일이 해당 날짜 이후인 상품 검색.  
  
등록일 검색 종료일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.
| created\_end\_date | 

상품 등록일 검색 종료일

상품 등록일이 해당 날짜 이전인 상품 검색.  
  
등록일 검색 시작일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.
| updated\_start\_date | 

상품 수정일 검색 시작일

상품 수정일이 해당 날짜 이후인 상품 검색.  
  
수정일 검색 종료일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.
| updated\_end\_date | 

상품 수정일 검색 종료일

상품 수정일이 해당 날짜 이전인 상품 검색.  
  
수정일 검색 시작일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.
| category | 

분류 번호

특정 분류에 진열된 상품 검색.
| eng\_product\_name | 

영문 상품명

검색어를 영문 상품명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.
| supply\_product\_name | 

공급사 상품명

검색어를 공급사 상품명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.
| internal\_product\_name | 

상품명(관리용)

,(콤마)로 여러 건을 검색할 수 있다.
| model\_name | 

모델명

검색어를 모델명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.
| product\_condition | 

상품 상태

특정 상품 상태 검색

,(콤마)로 여러 건을 검색할 수 있다.
| origin\_place\_value | 

원산지정보

원산지가 "기타(1800)"일 경우 원산지로 입력 가능한 정보.

,(콤마)로 여러 건을 검색할 수 있다.
| stock\_quantity\_max | 

재고수량 검색 최대값

재고가 해당 값 이하로 남아있는 상품 검색.  
  
품목을 여러개 갖고 있는 상품의 경우 해당 조건에 해당하는 품목이 하나라도 있을 경우 검색함.
| stock\_quantity\_min | 

재고수량 검색 최소값

재고가 해당 값 이상 남아있는 상품 검색.  
  
품목을 여러개 갖고 있는 상품의 경우 해당 조건에 해당하는 품목이 하나라도 있을 경우 검색함.
| stock\_safety\_max | 

안전재고수량 검색 최대값
| stock\_safety\_min | 

안전재고수량 검색 최소값
| product\_weight | 

상품 중량

해당 중량의 상품 검색.

,(콤마)로 여러 건을 검색할 수 있다.
| classification\_code | 

자체분류

,(콤마)로 여러 건을 검색할 수 있다.
| use\_inventory | 

재고 사용여부

해당 상품 품목이 재고를 사용하고 있는지 여부

T : 사용함  
F : 사용안함
| category\_unapplied | 

미적용 분류 검색

분류가 등록되지 않은 상품에 대하여 검색함.

T: 미적용 분류 검색
| include\_sub\_category | 

하위분류 포함 검색

하위분류에 등록된 상품을 포함하여 검색함.

T: 포함
| additional\_information\_key | 

추가항목 검색조건 키

추가항목에 대하여 검색하기 위한 키. 검색을 위해선 key 와 value 모두 필요함.
| additional\_information\_value | 

추가항목 검색조건 값

추가항목에 대하여 검색하기 위한 키의 값. 검색을 위해선 key 와 value 모두 필요함.
| approve\_status | 

승인상태 검색

N : 승인요청 (신규상품) 상태값  
E : 승인요청 (상품수정) 상태값  
C : 승인완료 상태값  
R : 승인거절 상태값  
I : 검수진행중 상태값
| since\_product\_no  

_최소값: \[0\]_  
_최대값: \[2147483647\]_

 | 

해당 상품번호 이후 검색

특정 상품번호 이후의 상품들을 검색. 해당 검색조건 사용시 offset과 관계 없이 모든 상품을 검색할 수 있다.  
  
※ 해당 검색 조건 사용시 다음 파라메터로는 사용할 수 없다.  
  
product\_no  
sort  
order  
offset
| product\_bundle | 

세트상품 여부

T : 사용함  
F : 사용안함
| option\_type | 

옵션 구성방식

,(콤마)로 여러 건을 검색할 수 있다.

C : 조합 일체선택형  
S : 조합 분리선택형  
E : 상품 연동형  
F : 독립 선택형
| market\_sync | 

마켓 연동 여부

T : 사용함  
F : 사용안함
| sort | 

정렬 순서 값

created\_date : 등록일  
updated\_date : 수정일  
product\_name : 상품명
| order | 

정렬 순서

asc : 순차정렬  
desc : 역순 정렬
| offset  

_최대값: \[5000\]_

 | 

조회결과 시작위치

조회결과 시작위치

DEFAULT 0
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

Retrieve a list of products

*   [Retrieve a list of products](#none)
*   [Retrieve multiple products](#none)
*   [Retrieve products using fields parameter](#none)
*   [Retrieve products using embed parameter](#none)
*   [Retrieve variants of the product using custom\_variant\_code](#none)
*   [Retrieve products using paging](#none)
*   [Retrieve products of specific brand](#none)
*   [Retrieve products using since\_product\_no instead of offset for retrieve all products](#none)
*   [Retrieve products using additional information parameter](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of products [](#retrieve-a-count-of-products)cafe24 youtube

GET /api/v2/products/count

###### GET

쇼핑몰에 등록된 전체 상품의 수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1
| product\_no | 

상품번호

조회하고자 하는 상품의 번호

,(콤마)로 여러 건을 검색할 수 있다.
| selling | 

판매상태

판매중이거나 판매안함 상태의 상품 검색.
| product\_name | 

상품명

검색어를 상품명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.
| product\_code | 

상품코드

상품 코드

,(콤마)로 여러 건을 검색할 수 있다.
| brand\_code | 

브랜드 코드

브랜드 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.
| manufacturer\_code | 

제조사 코드

제조사 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.
| supplier\_code | 

공급사 코드

공급사 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.
| trend\_code | 

트렌드 코드

트렌드 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.
| product\_tag | 

상품 검색어

검색어를 상품 검색어 또는 태그에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.
| custom\_product\_code | 

자체상품 코드

검색어를 자체상품코드에 포함하고 있는 상품 검색(대소문자 구분 필요)

,(콤마)로 여러 건을 검색할 수 있다.
| custom\_variant\_code | 

자체 품목 코드

,(콤마)로 여러 건을 검색할 수 있다.
| price\_min | 

상품 판매가 검색 최소값

판매가가 해당 범위 이상인 상품 검색
| price\_max | 

상품 판매가 검색 최대값

판매가가 해당 범위 이하인 상품 검색
| retail\_price\_min  

_최소값: \[0\]_  
_최대값: \[2147483647\]_

 | 

상품 소비자가 검색 최소값

소비자가가 해당 범위 이상인 상품 검색
| retail\_price\_max  

_최소값: \[0\]_  
_최대값: \[2147483647\]_

 | 

상품 소비자가 검색 최대값

소비자가가 해당 범위 이하인 상품 검색
| supply\_price\_min | 

상품 공급가 검색 최소값

공급가가 해당 범위 이하인 상품 검색
| supply\_price\_max | 

상품 공급가 검색 최대값

공급가가 해당 범위 이상인 상품 검색
| created\_start\_date | 

상품 등록일 검색 시작일

상품 등록일이 해당 날짜 이후인 상품 검색.  
  
등록일 검색 종료일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.
| created\_end\_date | 

상품 등록일 검색 종료일

상품 등록일이 해당 날짜 이전인 상품 검색.  
  
등록일 검색 시작일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.
| updated\_start\_date | 

상품 수정일 검색 시작일

상품 수정일이 해당 날짜 이후인 상품 검색.  
  
수정일 검색 종료일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.
| updated\_end\_date | 

상품 수정일 검색 종료일

상품 수정일이 해당 날짜 이전인 상품 검색.  
  
수정일 검색 시작일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.
| category | 

분류 번호

특정 분류에 진열된 상품 검색.
| eng\_product\_name | 

영문 상품명

검색어를 영문 상품명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.
| supply\_product\_name | 

공급사 상품명

검색어를 공급사 상품명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.
| internal\_product\_name | 

상품명(관리용)

,(콤마)로 여러 건을 검색할 수 있다.
| model\_name | 

모델명

검색어를 모델명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.
| product\_condition | 

상품 상태

특정 상품 상태 검색

,(콤마)로 여러 건을 검색할 수 있다.
| origin\_place\_value | 

원산지정보

원산지가 "기타(1800)"일 경우 원산지로 입력 가능한 정보.

,(콤마)로 여러 건을 검색할 수 있다.
| stock\_quantity\_max | 

재고수량 검색 최대값

재고가 해당 값 이하로 남아있는 상품 검색.  
  
품목을 여러개 갖고 있는 상품의 경우 해당 조건에 해당하는 품목이 하나라도 있을 경우 검색함.
| stock\_quantity\_min | 

재고수량 검색 최소값

재고가 해당 값 이상 남아있는 상품 검색.  
  
품목을 여러개 갖고 있는 상품의 경우 해당 조건에 해당하는 품목이 하나라도 있을 경우 검색함.
| stock\_safety\_max | 

안전재고수량 검색 최대값
| stock\_safety\_min | 

안전재고수량 검색 최소값
| product\_weight | 

상품 중량

해당 중량의 상품 검색.

,(콤마)로 여러 건을 검색할 수 있다.
| classification\_code | 

자체분류

자체분류 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.
| use\_inventory | 

재고 사용여부

해당 상품 품목이 재고를 사용하고 있는지 여부

T : 사용함  
F : 사용안함
| category\_unapplied | 

미적용 분류 검색

분류가 등록되지 않은 상품에 대하여 검색함.

T: 미적용 분류 검색
| include\_sub\_category | 

하위분류 포함 검색

하위분류에 등록된 상품을 포함하여 검색함.

T: 포함
| additional\_information\_key | 

추가항목 검색조건 키

추가항목에 대하여 검색하기 위한 키. 검색을 위해선 key 와 value 모두 필요함.
| additional\_information\_value | 

추가항목 검색조건 값

추가항목에 대하여 검색하기 위한 키의 값. 검색을 위해선 key 와 value 모두 필요함.
| approve\_status | 

승인상태 검색

N : 승인요청 (신규상품) 상태값  
E : 승인요청 (상품수정) 상태값  
C : 승인완료 상태값  
R : 승인거절 상태값  
I : 검수진행중 상태값
| since\_product\_no  

_최소값: \[0\]_  
_최대값: \[2147483647\]_

 | 

해당 상품번호 이후 검색

특정 상품번호 이후의 상품들을 검색. 해당 검색조건 사용시 offset과 관계 없이 모든 상품을 검색할 수 있다.  
  
※ 해당 검색 조건 사용시 다음 파라메터로는 사용할 수 없다.  
  
product\_no  
sort  
order  
offset
| product\_bundle | 

세트상품 여부

T : 사용함  
F : 사용안함
| option\_type | 

옵션 구성방식

,(콤마)로 여러 건을 검색할 수 있다.

C : 조합 일체선택형  
S : 조합 분리선택형  
E : 상품 연동형  
F : 독립 선택형
| market\_sync | 

마켓 연동 여부

T : 사용함  
F : 사용안함

Retrieve a count of products

*   [Retrieve a count of products](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a product resource [](#retrieve-a-product-resource)cafe24 youtube

GET /api/v2/products/{product\_no}

###### GET

쇼핑몰에 생성되어 있는 상품을 조회할 수 있습니다.  
상품코드, 자체상품 코드, 상품명, 상품 판매가 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1
| **product\_no**  
**Required** | 

상품번호

조회하고자 하는 상품의 번호
| variants  
**embed** | 

품목 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.
| memos  
**embed** | 

메모 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.
| hits  
**embed** | 

상품 조회수 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.
| seo  
**embed** | 

상품 Seo 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.
| tags  
**embed** | 

상품 태그 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.
| options  
**embed** | 

상품 옵션 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.
| discountprice  
**embed** | 

상품 할인판매가 리소스
| decorationimages  
**embed** | 

꾸미기 이미지 리소스
| benefits  
**embed** | 

혜택 리소스
| additionalimages  
**embed** | 

추가 이미지 리소스
| custom\_properties  
**embed** | 

사용자 정의 속성

Retrieve a product resource

*   [Retrieve a product resource](#none)
*   [Retrieve a product with fields parameter](#none)
*   [Retrieve a product with embed](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products decorationimages

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20decorationimages.png)  
  
꾸미기 이미지(Decorationimages)는 쇼핑몰에 진열된 상품에 등록되어있는 꾸미기 이미지를 조회할 수 있습니다.  
꾸미기 이미지는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

> Endpoints

```
GET /api/v2/products/{product_no}/decorationimages
```

#### \[더보기 상세 내용\]

### Products decorationimages property list[](#products__decorationimages-property-list)

| **Attribute** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호
| use\_show\_date | 

표시기간 사용 여부

T : 사용함  
F : 사용안함
| show\_start\_date | 

표시기간 시작 일자
| show\_end\_date | 

표시기간 종료 일자
| image\_list | 

꾸미기 이미지 리스트

수평위치(image\_horizontal\_position)  
L : 왼쪽  
C : 가운데  
R : 오른쪽  
  
수직위치(image\_vertical\_position)  
T : 상단  
C : 중단  
B : 하단

### Retrieve a list of product decoration images [](#retrieve-a-list-of-product-decoration-images)cafe24 youtube

GET /api/v2/products/{product\_no}/decorationimages

###### GET

특정 상품에 등록되어 있는 꾸미기 이미지를 목록으로 조회합니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

Retrieve a list of product decoration images

*   [Retrieve a list of product decoration images](#none)
*   [Retrieve decorationimages with fields parameter](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products discountprice

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20discountprice.png)  
  
상품 할인가(Discountprice)는 상품의 할인가격을 표시하는 리소스입니다. 혜택(Benefits)이 적용된 상품의 경우 상품의 할인가를 조회할 수 있습니다.  
상품 할인가는 하위 리소스로서 상품(Products) 하위에서만 사용가능하며, 상품 목록 조회시 Embed 파라메터로 호출가능합니다.

> Endpoints

```
GET /api/v2/products/{product_no}/discountprice
```

#### \[더보기 상세 내용\]

### Products discountprice property list[](#products__discountprice-property-list)

| **Attribute** | **Description** | --- | --- | pc\_discount\_price | 
PC 할인 판매가
| mobile\_discount\_price | 

모바일 할인 판매가
| app\_discount\_price | 

앱 할인 판매가

### Retrieve a product discounted price [](#retrieve-a-product-discounted-price)cafe24 youtube

GET /api/v2/products/{product\_no}/discountprice

###### GET

상품번호를 이용하여 해당 상품의 할인가를 조회합니다.  
PC 할인 판매가, 모바일 할인 판매가를 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1
| **product\_no**  
**Required** | 

상품번호

Retrieve a product discounted price

*   [Retrieve a product discounted price](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products hits

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20hits.png)  
  
상품 조회수(Hits)는 상품을 쇼핑몰 고객들이 얼마나 조회했는지를 나타내는 지표입니다.  
상품 조회수를 확인하면, 고객들이 어떤 상품을 가장 많이 조회하는지 알 수 있습니다.  
상품 조회수는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

> Endpoints

```
GET /api/v2/products/{product_no}/hits/count
```

#### \[더보기 상세 내용\]

### Retrieve a count of product views [](#retrieve-a-count-of-product-views)cafe24 youtube

GET /api/v2/products/{product\_no}/hits/count

###### GET

상품번호를 이용하여 해당 상품의 조회수를 조회합니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

Retrieve a count of product views

*   [Retrieve a count of product views](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products icons

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20icons.png)  
  
상품 아이콘은 상품을 강조하기 위해 상품 옆에 추가할 수 있는 작은 이미지들입니다. 진열된 상품에 할인 정보, "매진 임박" 등의 메시지를 추가하여 상품을 강조할 수 있습니다.  
상품 아이콘는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

> Endpoints

```
GET /api/v2/products/{product_no}/icons
```

#### \[더보기 상세 내용\]

### Products icons property list[](#products__icons-property-list)

| **Attribute** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호
| use\_show\_date | 

표시기간 사용 여부

T : 사용함  
F : 사용안함
| show\_start\_date | 

표시기간 시작 일자
| show\_end\_date | 

표시기간 종료 일자
| image\_list | 

상품 아이콘 리스트

### Retrieve a list of product icons [](#retrieve-a-list-of-product-icons)cafe24 youtube

GET /api/v2/products/{product\_no}/icons

###### GET

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1
| **product\_no**  
**Required** | 

상품번호

Retrieve a list of product icons

*   [Retrieve a list of product icons](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products options

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20options.png)  
  
상품 옵션(Products options)은 상품이 다른 색상이나 사이즈를 갖고 있는 경우 이를 각각의 옵션으로 구현할 수 있도록 하는 기능입니다.  
옵션은 색상, 사이즈 같은 옵션명(option\_name)과 색상 중 빨간색, 노란색과 같은 옵션값(option\_value)으로 구성되어있습니다.  
상품에 옵션 등록시 옵션을 기반으로 품목(variants)이 생성됩니다.  
옵션은 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.  
옵션의 목록조회, 생성, 수정, 삭제가 가능합니다.

> Endpoints

```
GET /api/v2/products/{product_no}/options
```

#### \[더보기 상세 내용\]

### Products options property list[](#products__options-property-list)

| **Attribute** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.
| has\_option | 

옵션 사용여부

T : 사용함  
F : 사용안함
| option\_type | 

옵션 구성방식

옵션을 사용할 경우, 옵션의 유형 표시  
  
● 조합형 : 옵션명을 기준으로 옵션값을 조합할 수 있음  
● 상품 연동형 : 옵션표시방식은 조합형과 유사하지만 필수옵션과 선택옵션을 선택할 수 있음. 옵션의 조합을 제한 없이 생성할 수 있음.  
● 독립 선택형 : 독립적인 조건 여러개를 각각 선택할 수 있는 옵션으로 옵션 값이 조합되지 않고 각각의 품목으로 생성됨.

T : 조합형  
E : 연동형  
F : 독립형
| option\_list\_type | 

옵션 표시방식

조합형 옵션을 사용할 경우, 조합형 옵션의 유형 표시  
  
\* 조합 일체선택형 : 하나의 셀렉스박스(버튼 이나 라디오버튼)에 모든 옵션이 조합되어 표시됨  
\* 조합 분리선택형 : 옵션을 각각의 셀렉스박스(버튼 이나 라디오버튼)로 선택할 수 있으며 옵션명을 기준으로 옵션값을 조합할 수 있음  
  
독립형이나 상품 연동형 옵션을 사용하고 있을 경우 S(분리형)로 입력됨.

C : 일체형  
S : 분리형
| options | 

옵션
| select\_one\_by\_option | 

옵션별로 한 개씩 선택 (독립형 옵션)

독립형 옵션을 사용할 경우, 하나의 옵션을 여러개 중복하여 선택할 수 없고 한개씩만 선택 가능함.

T : 사용함  
F : 사용안함
| use\_additional\_option | 

추가입력 옵션 사용여부

T : 사용함  
F : 사용안함
| additional\_options | 

추가입력 옵션
| use\_attached\_file\_option | 

파일 첨부 옵션 사용여부

T : 사용함  
F : 사용안함
| attached\_file\_option | 

파일 첨부 옵션

### Retrieve a list of product options [](#retrieve-a-list-of-product-options)cafe24 youtube

GET /api/v2/products/{product\_no}/options

###### GET

상품의 옵션을 목록으로 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

Retrieve a list of product options

*   [Retrieve a list of product options](#none)
*   [Retrieve options with fields parameter](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products variants

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20variants.png)  
  
상품의 품목(Products variants)은 쇼핑몰에서 판매되는 상품의 기본 단위입니다.  
쇼핑몰은 일반적으로 고객에게 다양한 선택권을 제공하기 위해 같은 상품이지만 사이즈가 다르거나, 혹은 색상이 다른 품목들을 판매합니다.  
품목의 조회, 등록, 수정 또는 삭제를 할 수 있습니다.

> Endpoints

```
GET /api/v2/products/{product_no}/variants
GET /api/v2/products/{product_no}/variants/{variant_code}
```

#### \[더보기 상세 내용\]

### Products variants property list[](#products__variants-property-list)

| **Attribute** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.
| variant\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

품목코드

시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않음.
| options | 

옵션
| display | 

진열상태

해당 품목을 진열할지 여부. 품목을 진열할 경우 상품 상세 또는 상품 목록에서 해당 품목을 선택할 수 있다. 품목이 진열되어있지 않을 경우 해당 품목이 표시되지 않으며 해당 품목을 구매할 수 없다.

T : 진열함  
F : 진열안함
| selling | 

판매상태

해당 품목을 판매할지 여부. 진열은 되어있으나 판매는 하지 않을 경우 해당 품목은 "품절"로 표시되며 해당 품목을 구매할 수 없다. 품목이 "판매함" 상태여도 "진열안함"으로 되어있다면 해당 품목을 구매할 수 없다.

T : 판매함  
F : 판매안함
| display\_order  

_최소: \[1\]~최대: \[300\]_

 | 

진열 순서
| additional\_amount | 

추가금액

해당 품목을 구매할 경우, 상품의 판매가에 더하여 지불해야하는 추가 가격.
| display\_soldout | 

품절표시여부

T : 품절표시 사용  
F : 품절표시 사용안함
| quantity | 

수량
| safety\_inventory | 

안전재고수량
| image | 

품목 이미지
| inventories | 

재고 리소스

품목의 재고 리소스  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

### Retrieve a list of product variants [](#retrieve-a-list-of-product-variants)cafe24 youtube

GET /api/v2/products/{product\_no}/variants

###### GET

상품의 품목을 목록으로 조회할 수 있습니다.  
상품 품목 코드, 진열상태, 판매상태 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.
| inventories  
**embed** | 

재고 리소스

품목의 재고 리소스  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

,(콤마)로 여러 건을 검색할 수 있다.

Retrieve a list of product variants

*   [Retrieve a list of product variants](#none)
*   [Retrieve variants with fields parameter](#none)
*   [Retrieve variants with embed parameter](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a product variant [](#retrieve-a-product-variant)cafe24 youtube

GET /api/v2/products/{product\_no}/variants/{variant\_code}

###### GET

상품의 특정 품목을 조회할 수 있습니다.  
옵션정보, 자체 품목 코드, 진열 및 판매상태 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.
| **variant\_code**  
**Required**  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

품목코드
| inventories  
**embed** | 

재고 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

Retrieve a product variant

*   [Retrieve a product variant](#none)
*   [Retrieve a product variant with fields parameter](#none)
*   [Retrieve a product variant with embed](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products variants inventories

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Products%20variants%20inventories.png)  
  
재고(Inventories)는 판매 가능한 해당 품목의 수량을 의미합니다. 재고는 품목(Variants)별로 존재하며 해당 재고 이상 품목이 판매되면 해당 상품은 품절 상태가 됩니다.

> Endpoints

```
GET /api/v2/products/{product_no}/variants/{variant_code}/inventories
```

#### \[더보기 상세 내용\]

### Products variants inventories property list[](#products__variants__inventories-property-list)

| **Attribute** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.
| variant\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

품목코드

시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않는다.
| quantity | 

수량

해당 품목에 판매가 가능한 재고 수량. 재고 수량은 주문 또는 결제시 차감되며, 품절 표시를 위하여 체크된다.
| safety\_inventory | 

안전재고수량
| origin\_code | 

출고지 코드

### Retrieve inventory details of a product variant [](#retrieve-inventory-details-of-a-product-variant)cafe24 youtube

GET /api/v2/products/{product\_no}/variants/{variant\_code}/inventories

###### GET

상품의 품목의 재고를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.
| **variant\_code**  
**Required**  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

품목코드

판매 수량을 검색할 품목 코드

Retrieve inventory details of a product variant

*   [Retrieve inventory details of a product variant](#none)
*   [Retrieve inventories with fields parameter](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Productsdetail

상품상세정보(Productsdetail)는 상품 상세페이지에 노출되는 항목과 그 값을 조회할 수 있는 기능입니다.

> Endpoints

```
GET /api/v2/productsdetail/{product_no}
```

#### \[더보기 상세 내용\]

### Productsdetail property list[](#productsdetail-property-list)

| **Attribute** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.
| product\_no | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.
| detail\_image | 

상세이미지

상품 상세 화면에 표시되는 상품 이미지.
| small\_image | 

축소이미지

상품 상세 화면 하단에 표시되는 상품 목록 이미지.
| additional\_images  

_배열 최대사이즈: \[20\]_

 | 

추가이미지

상품 상세 화면 하단에 표시되는 상품의 추가 이미지. 축소 이미지와 비슷한 위치에 표시되며 PC 쇼핑몰에서는 마우스 오버시, 모바일 쇼핑몰에서는 이미지 스와이프(Swipe)시 추가 이미지를 확인할 수 있다.
| product\_name | 

상품명

상품의 이름. 상품명은 상품을 구분하는 가장 기초적인 정보이며 검색 정보가 된다. HTML을 사용하여 입력이 가능하다.
| manufacturer\_name | 

제조사

제조사의 이름. 제조사명은 쇼핑몰 관리자 화면에서 제조사를 구분할 수 있는 기본적인 정보이다.
| origin\_place\_value | 

원산지
| retail\_price | 

상품 소비자가

시중에 판매되는 소비자 가격. 쇼핑몰의 가격을 강조하기 위한 비교 목적으로 사용함.
| price | 

판매가

상품의 판매 가격. 쿠폰 및 혜택을 적용하기 전의 가격.  
상품 등록시엔 모든 멀티 쇼핑몰에 동일한 가격으로 등록하며, 멀티쇼핑몰별로 다른 가격을 입력하고자 할 경우 상품 수정을 통해 가격을 다르게 입력할 수 있다.  
※ 판매가 = \[ 공급가 + (공급가 \* 마진율) + 추가금액 \]
| interest\_free\_period | 

무이자할부 기간

무이자할부가 설정되었을 때 적용 가능한 기간
| eng\_product\_name | 

영문 상품명

상품의 영문 이름. 해외 배송 등에 사용 가능함.
| custom\_product\_code | 

자체상품 코드

사용자가 상품에 부여 가능한 코드. 재고 관리등의 이유로 자체적으로 상품을 관리 하고 있는 경우 사용함.
| points\_amount | 

적립금

상품 주문시 받을 수 있는 적립금 금액. 설정에 따라 적립금을 결제수단에 상관 없이 공통적으로 받도록 설정하거나 결제수단별로 받도록 설정할 수 있다.
| brand\_name | 

브랜드 명
| model\_name | 

모델명

상품의 모델명.
| price\_excluding\_tax | 

상품 판매가

세금을 제외한 상품의 판매가  
tax\_calculation이 A(자동계산)일 경우 null로 반환됨.
| tax | 

세액
| product\_code | 

상품코드

시스템이 상품에 부여한 코드. 해당 쇼핑몰 내에서 상품코드는 중복되지 않음.
| simple\_description | 

상품 간략 설명

상품에 대한 간략한 정보. 상품 진열 화면에서 노출 가능한 설명. HTML을 사용하여 입력이 가능하다.  
\[쇼핑몰 설정 > 상품 설정 > '상품 보기 설정 > 상품 정보 표시 설정'\]에서 노출되도록 설정 가능하다.
| summary\_description | 

상품요약설명

상품에 대한 요약 정보. 상품 진열 화면에서 노출 가능한 설명. HTML을 사용하여 입력이 가능하다.  
\[쇼핑몰 설정 > 상품 설정 > '상품 보기 설정 > 상품 정보 표시 설정'\]에서 노출되도록 설정 가능하다.
| supplier\_name | 

공급사명

공급사의 이름. 공급사명은 쇼핑몰 관리자 화면에서 공급사를 구분할 수 있는 기본적인 정보이다.
| made\_date | 

제조일자

상품을 제조한 제조일자.
| review\_count | 

사용후기 갯수

상품을 선택하고 사용후기에 글이 등록된 수
| expiration\_date | 

유효기간

상품을 정상적으로 사용할 수 있는 기간. 상품권이나 티켓 같은 무형 상품, 식품이나 화장품 같은 유형 상품의 유효기간을 표시.
| coupon\_discounted\_price | 

쿠폰적용가

상품에 쿠폰이 설정되었을 때 해당 쿠폰을 적용한 금액
| trend\_name | 

트렌드 명
| shipping\_scope | 

배송정보

국내에만 배송이 가능한 상품인지 해외에도 배송이 가능한 상품인지 표시. \[쇼핑몰 설정 > 배송 설정 > '배송 정책 설정 > 배송비 설정 > 개별배송비 설정'\] 에서 상품별 개별배송료 설정이 사용안함인 경우 설정 불가.  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.
| shipping\_fee\_type | 

배송비 타입

shipping\_calculation이 A(자동계산)일 경우 null로 반환.

T : 배송비 무료  
R : 고정배송비 사용  
M : 구매 금액에 따른 부과  
D : 구매 금액별 차등 배송료 사용  
W : 상품 무게별 차등 배송료 사용  
C : 상품 수량별 차등 배송료 사용  
N : 상품 수량에 비례하여 배송료 부과
| shipping\_rates | 

구간별 배송비

개별배송비를 사용할 경우 상품의 개별 배송비.  
  
shipping\_rates\_min : 배송비 구간 시작 기준  
shipping\_rates\_max : 배송비 구간 종료 기준  
shipping\_fee : 배송비  
  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.
| shipping\_fee | 

배송비
| discount\_price | 

할인판매가

상품에 할인이 설정되었을 때 할인을 적용한 판매가
| optimum\_discount\_price | 

최적할인가
| shipping\_method | 

배송방법

배송 수단 및 방법  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.
| promotion\_period | 

할인 기간

상품에 할인이 설정되었을 때 해당 할인이 적용되는 기간
| colors | 

상품색상
| translated\_additional\_description | 

상품 추가설명 번역정보
| stock\_quantity | 

재고수량
| question\_count | 

상품문의(수)

상품을 선택하고 상품문의에 글이 등록된 수
| relation\_count | 

관련상품(수)

상품 등록/수정 시 관련상품으로 등록된 상품 수
| product\_material | 

상품소재
| product\_article\_count | 

상품자유게시판(수)

상품을 선택하고 상품자유게시판에 글이 등록된 수
| additional\_information | 

추가항목

상품 등록/수정 시 추가적으로 입력한 항목
| payment\_methods | 

결제수단
| add\_products | 

추가구성상품

상품 등록/수정 시 추가구성상품으로 등록된 상품 수

### Retrieve the details of a product [](#retrieve-the-details-of-a-product)cafe24 youtube

GET /api/v2/productsdetail/{product\_no}

###### GET

상품의 상세페이지에 노출되는 항목과 그 값을 조회할 수 있습니다.  
상품명, 제조사, 이미지 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품 읽기권한 (mall.read\_product)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.
| mobile | 

모바일 설정값 조회 여부

T : 사용함  
F : 사용안함

Retrieve the details of a product

*   [Retrieve the details of a product](#none)
*   [Retrieve a produtct detail with fields parameter](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Category

## Categories

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Categories.png)  
  
상품분류(Categories)는 쇼핑몰에 노출할 카테고리를 설정하는 기능입니다.  
상품분류는 대분류 하위에 중분류, 소분류, 상세 분류까지 세분화해서 설정할 수 있습니다.  
상품분류 리소스를 사용하면 쇼핑몰의 분류들을 조회하거나 분류를 생성, 수정, 삭제할 수 있습니다.

> Endpoints

```
GET /api/v2/categories
GET /api/v2/categories/count
GET /api/v2/categories/{category_no}
```

#### \[더보기 상세 내용\]

### Categories property list[](#categories-property-list)

| **Attribute** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.
| category\_no | 

분류 번호

상품분류의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품분류 번호는 중복되지 않음.
| category\_depth  

_최소: \[1\]~최대: \[4\]_

 | 

분류 Depth

해당 상품분류가 하위 몇 차 상품분류에 있는 카테고리인지 표시함. 1~4차까지 상품분류가 존재한다.
| parent\_category\_no | 

부모 분류 번호

해당 상품분류가 2차(중분류), 3차(소분류), 4차(세분류)일 경우 상위에 있는 상품분류의 번호를 표시함.  
  
parent\_category\_no = 1일 경우 해당 분류는 대분류를 의미한다.
| category\_name  

_최대글자수 : \[50자\]_

 | 

분류명

해당 상품분류의 이름을 나타낸다.
| full\_category\_name | 

분류 전체 이름

해당 상품분류가 속해있는 상위 상품분류의 이름을 모두 표시.
| full\_category\_no | 

분류 전체 번호

해당 상품분류가 속해있는 상위 상품분류의 번호를 모두 표시.
| root\_category\_no | 

최상위 분류 번호

해당 상품분류가 속해있는 최상위 상품분류의 분류 번호 표시.
| use\_display | 

표시상태

해당 상품분류의 표시 여부. 표시안함 일 경우 해당 상품분류에 접근할 수 없다.  
  
해당 설정은 멀티쇼핑몰별로 설정할 수 없으며 모든 쇼핑몰에 적용된다.

T : 표시함  
F : 표시안함
| display\_order | 

진열 순서

상품분류를 쇼핑몰 운영자가 배치한 순서.
| hash\_tags | 

쇼핑 큐레이션 해시태그

해당 상품분류의 해시태그 목록  
  
※ 해당 기능은 쇼핑 큐레이션 서비스를 사용하는 경우에만 사용 가능하다.

### Retrieve a list of product categories [](#retrieve-a-list-of-product-categories)cafe24

GET /api/v2/categories

###### GET

쇼핑몰에 등록된 분류를 목록으로 조회합니다.  
분류의 분류번호와 분류명 등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품분류 읽기권한 (mall.read\_category)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1
| category\_depth  

_최소: \[1\]~최대: \[4\]_

 | 

분류 Depth

조회하고자 하는 상품분류의 차수 검색
| category\_no | 

분류 번호

조회하고자 하는 상품분류의 번호

,(콤마)로 여러 건을 검색할 수 있다.
| parent\_category\_no | 

부모 분류 번호

조회하고자 하는 상품분류의 부모 상품분류 번호 검색  
  
대분류만 검색하고자 할 경우 parent\_category\_no =1 로 검색한다.
| category\_name | 

분류명

검색어를 분류명에 포함하고 있는 상품분류 검색
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

조회결과 시작위치

DEFAULT 0
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

Retrieve a list of product categories

*   [Retrieve a list of product categories](#none)
*   [Retrieve categories using paging](#none)
*   [Retrieve a specific categories with category\_no parameter](#none)
*   [Retrieve categories with fields parameter](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of product categories [](#retrieve-a-count-of-product-categories)cafe24

GET /api/v2/categories/count

###### GET

쇼핑몰에 등록된 분류의 수를 조회합니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품분류 읽기권한 (mall.read\_category)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1
| category\_depth  

_최소: \[1\]~최대: \[4\]_

 | 

분류 Depth

조회하고자 하는 상품분류의 차수 검색
| category\_no | 

분류 번호

조회하고자 하는 상품분류의 번호

,(콤마)로 여러 건을 검색할 수 있다.
| parent\_category\_no | 

부모 분류 번호

조회하고자 하는 상품분류의 부모 상품분류 번호 검색  
  
대분류만 검색하고자 할 경우 parent\_category\_no =1 로 검색한다.
| category\_name | 

분류명

검색어를 분류명에 포함하고 있는 상품분류 검색

Retrieve a count of product categories

*   [Retrieve a count of product categories](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a product category [](#retrieve-a-product-category)cafe24

GET /api/v2/categories/{category\_no}

###### GET

분류번호를 이용하여 해당 분류에 대해 상세조회합니다.  
분류 Depth, 부모 분류 번호, 분류명 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **상품분류 읽기권한 (mall.read\_category)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1
| **category\_no**  
**Required** | 

분류 번호

조회하고자 하는 상품분류의 번호

Retrieve a product category

*   [Retrieve a product category](#none)
*   [Retrieve a category with fields parameter](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Personal

## Carts

장바구니(Carts)는 상품을 주문하기 전 한번에 주문할 수 있도록 상품을 미리 담아두는 기능입니다.  
장바구니 리소스에서는 Front API를 사용하여 특정 상품을 장바구니에 담을 수 있고 Admin API에서는 특정 회원의 장바구니를 조회할 수 있습니다.

> Endpoints

```
POST /api/v2/carts
```

#### \[더보기 상세 내용\]

### Carts property list[](#carts-property-list)

| **Attribute** | **Description** | --- | --- | duplicated\_item | 
장바구니 내의 아이템 코드 중복 여부

T : 품목이 중복됨  
F : 품목이 중복되지 않음
| variants | 

품목
| product\_no | 

상품번호
| basket\_type | 

장바구니 타입

A0000 : 일반  
A0001 : 무이자
| prepaid\_shipping\_fee | 

배송비 선결제 설정

P : 선불  
C : 착불

### Create a shopping cart [](#create-a-shopping-cart)cafe24

POST /api/v2/carts

###### POST

특정 상품을 장바구니에 담을 수 있습니다.  
해당 API는 로그인 세션(브라우저 세션)을 기반으로 동작합니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **개인화정보 쓰기권한 (mall.write\_personal)** | 호출건수 제한 | **40** | 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호

DEFAULT 1
| variants | 

품목

장바구니에 추가할 품목의 개수와 품목 코드  
연동형 옵션을 장바구니에 담을 경우 options에서 option\_code와 value\_no를 사용하여 담을 수 있음
| 

variants 하위 요소 보기

**quantity**  
**Required**  
수량

**variants\_code**  
**Required**  
상품 품목 코드

**options** _Array_

options 하위 요소 보기

**option\_code**  
옵션코드

**value\_no**  
옵션값

**additional\_option\_values** _Array_

additional\_option\_values 하위 요소 보기

**key**  
추가옵션 키값

**type**  
추가옵션 타입

**name**  
추가옵션명

**value**  
추가옵션값
| addtional\_products | 

추가구성상품의 품목
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호  
해당 쇼핑몰 내에서 상품 번호는 중복되지 않음
| **basket\_type**  
**Required** | 

장바구니 타입

무이자할부 가능한 상품일 경우 무이자 타입으로 설정 가능

A0000 : 일반  
A0001 : 무이자
| **duplicated\_item\_check**  
**Required** | 

장바구니 중복체크

장바구니에 추가할 품목에 대하여 중복을 허용할지 여부  
중복을 허용하면 품목의 개수가 추가됨  
중복을 허용하지 않으면 해당 품목은 장바구니에 추가되지 않음

T : 품목 중복체크  
F : 품목 중복체크 안함
| **prepaid\_shipping\_fee**  
**Required** | 

배송비 선결제 설정

P : 선불  
C : 착불

Create a shopping cart

*   [Create a shopping cart](#none)
*   [Add the product in the cart](#none)
*   [Add the product has linkage option(option template) in the cart](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products carts

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Products%20carts.png)  
  
상품 장바구니(Products carts)는 특정 상품을 장바구니에 담은 회원과 그 숫자를 조회할 수 있는 리소스입니다.  
특정 상품을 장바구니에 담은 회원의 ID, 담은날짜와 회원의 수 정보를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/products/{product_no}/carts/count
```

#### \[더보기 상세 내용\]

### Retrieve a count of carts containing a product [](#retrieve-a-count-of-carts-containing-a-product)cafe24

GET /api/v2/products/{product\_no}/carts/count

###### GET

특정 상품을 장바구니에 담은 회원의 수를 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** | --- | --- | SCOPE | **개인화정보 읽기권한 (mall.read\_personal)** | 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** | --- | --- | shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

Retrieve a count of carts containing a product

*   [Retrieve a count of carts containing a product](#none)

> Request Javascript cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

[Top](#)