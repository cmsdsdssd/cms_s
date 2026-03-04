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
        *   [Admin API Intro](#admin-api-intro)
        *   [API Status Code](#api-status-code)
        *   [How to use GET API](#how-to-use-get-api)
        *   [API Limit](#api-limit)
        *   [Versioning](#versioning)
    *   [Authentication](#authentication)
        *   [Get Authentication Code](#get-authentication-code)
        *   [Get Access Token](#get-access-token)
        *   [Get Access Token using refresh token](#get-access-token-using-refresh-token)
        *   [Revoke Access Token](#revoke-access-token)
*   #### Store
    
    *   [Activitylogs](#activitylogs)
        *   [Activitylogs property list](#activitylogs-property-list)
        *   [Retrieve a list of action logs](#retrieve-a-list-of-action-logs)
        *   [Retrieve an action log](#retrieve-an-action-log)
    *   [Automessages arguments](#automessages-arguments)
        *   [Automessages arguments property list](#automessages-arguments-property-list)
        *   [Retrieve the list of available variables for automated messages](#retrieve-the-list-of-available-variables-for-automated-messages)
    *   [Automessages setting](#automessages-setting)
        *   [Automessages setting property list](#automessages-setting-property-list)
        *   [Retrieve the automated message settings](#retrieve-the-automated-message-settings)
        *   [Update an automated message](#update-an-automated-message)
    *   [Benefits setting](#benefits-setting)
        *   [Benefits setting property list](#benefits-setting-property-list)
        *   [Retrieve incentive settings](#retrieve-incentive-settings)
        *   [Update incentive settings](#update-incentive-settings)
    *   [Boards setting](#boards-setting)
        *   [Boards setting property list](#boards-setting-property-list)
        *   [Retrieve board settings](#retrieve-board-settings)
        *   [Update board settings](#update-board-settings)
    *   [Carts setting](#carts-setting)
        *   [Carts setting property list](#carts-setting-property-list)
        *   [Retrieve carts settings](#retrieve-carts-settings)
        *   [Update carts settings](#update-carts-settings)
    *   [Categories properties setting](#categories-properties-setting)
        *   [Categories properties setting property list](#categories-properties-setting-property-list)
        *   [Retrieve additional settings for products in the list](#retrieve-additional-settings-for-products-in-the-list)
        *   [Update additional settings for products in the list](#update-additional-settings-for-products-in-the-list)
    *   [Coupons setting](#coupons-setting)
        *   [Coupons setting property list](#coupons-setting-property-list)
        *   [Retrieve coupon settings](#retrieve-coupon-settings)
        *   [Update coupon settings](#update-coupon-settings)
    *   [Currency](#currency)
        *   [Currency property list](#currency-property-list)
        *   [Retrieve currency settings](#retrieve-currency-settings)
        *   [Update a currency](#update-a-currency)
    *   [Customers setting](#customers-setting)
        *   [Customers setting property list](#customers-setting-property-list)
        *   [Retrieve member-related settings](#retrieve-member-related-settings)
        *   [Update customers setting](#update-customers-setting)
    *   [Dashboard](#dashboard)
        *   [Dashboard property list](#dashboard-property-list)
        *   [Retrieve a dashboard](#retrieve-a-dashboard)
    *   [Dormantaccount](#dormantaccount)
        *   [Dormantaccount property list](#dormantaccount-property-list)
        *   [Retrieve account deactivation settings](#retrieve-account-deactivation-settings)
        *   [Update account deactivation settings](#update-account-deactivation-settings)
    *   [Financials paymentgateway](#financials-paymentgateway)
        *   [Financials paymentgateway property list](#financials-paymentgateway-property-list)
        *   [Retrieve a list of Payment Gateway contract details](#retrieve-a-list-of-payment-gateway-contract-details)
    *   [Financials store](#financials-store)
        *   [Financials store property list](#financials-store-property-list)
        *   [Retrieve the transaction information of a store](#retrieve-the-transaction-information-of-a-store)
    *   [Images setting](#images-setting)
        *   [Images setting property list](#images-setting-property-list)
        *   [Retrieve product image size settings](#retrieve-product-image-size-settings)
        *   [Update product image size settings](#update-product-image-size-settings)
    *   [Information](#information)
        *   [Information property list](#information-property-list)
        *   [Retrieve store policies](#retrieve-store-policies)
        *   [Update store policies](#update-store-policies)
    *   [Kakaoalimtalk profile](#kakaoalimtalk-profile)
        *   [Kakaoalimtalk profile property list](#kakaoalimtalk-profile-property-list)
        *   [Retrieve a Kakao Channel sender profile key](#retrieve-a-kakao-channel-sender-profile-key)
    *   [Kakaoalimtalk setting](#kakaoalimtalk-setting)
        *   [Kakaoalimtalk setting property list](#kakaoalimtalk-setting-property-list)
        *   [Retrieve the Kakao Info-talk settings](#retrieve-the-kakao-info-talk-settings)
        *   [Update the Kakao Info-talk settings](#update-the-kakao-info-talk-settings)
    *   [Kakaopay setting](#kakaopay-setting)
        *   [Kakaopay setting property list](#kakaopay-setting-property-list)
        *   [Retrieve settings for KakaoPay orders](#retrieve-settings-for-kakaopay-orders)
        *   [Update settings for KakaoPay orders](#update-settings-for-kakaopay-orders)
    *   [Mains properties setting](#mains-properties-setting)
        *   [Mains properties setting property list](#mains-properties-setting-property-list)
        *   [Retrieve additional settings for products on the main screen](#retrieve-additional-settings-for-products-on-the-main-screen)
        *   [Update additional settings for products on the main screen](#update-additional-settings-for-products-on-the-main-screen)
    *   [Menus](#menus)
        *   [Menus property list](#menus-property-list)
        *   [Retrieve menus](#retrieve-menus)
    *   [Mobile setting](#mobile-setting)
        *   [Mobile setting property list](#mobile-setting-property-list)
        *   [Retrieve mobile settings](#retrieve-mobile-settings)
        *   [Update mobile settings](#update-mobile-settings)
    *   [Naverpay setting](#naverpay-setting)
        *   [Naverpay setting property list](#naverpay-setting-property-list)
        *   [Retrieve Naver Pay settings](#retrieve-naver-pay-settings)
        *   [Create Naver Pay settings](#create-naver-pay-settings)
        *   [Update Naver Pay settings](#update-naver-pay-settings)
    *   [Orderform setting](#orderform-setting)
        *   [Orderform setting property list](#orderform-setting-property-list)
        *   [Retrieve the order/order form settings](#retrieve-the-order-order-form-settings)
        *   [Update the order/order form settings](#update-the-order-order-form-settings)
    *   [Orders setting](#orders-setting)
        *   [Orders setting property list](#orders-setting-property-list)
        *   [Retrieve Order Settings](#retrieve-order-settings)
        *   [Update Order settings](#update-order-settings)
    *   [Orders status](#orders-status)
        *   [Orders status property list](#orders-status-property-list)
        *   [Retrieve order status displayed](#retrieve-order-status-displayed)
        *   [Update order status displayed](#update-order-status-displayed)
    *   [Payment setting](#payment-setting)
        *   [Payment setting property list](#payment-setting-property-list)
        *   [Retrieve payment settings](#retrieve-payment-settings)
        *   [Update payment settings](#update-payment-settings)
    *   [Paymentgateway](#paymentgateway)
        *   [Paymentgateway property list](#paymentgateway-property-list)
        *   [Create a Payment Gateway](#create-a-payment-gateway)
        *   [Update a Payment Gateway](#update-a-payment-gateway)
        *   [Delete a Payment Gateway](#delete-a-payment-gateway)
    *   [Paymentgateway paymentmethods](#paymentgateway__paymentmethods)
        *   [Paymentgateway paymentmethods property list](#paymentgateway__paymentmethods-property-list)
        *   [Retrieve a list of Payment Gateway methods](#retrieve-a-list-of-payment-gateway-methods)
        *   [Create a Payment Gateway method](#create-a-payment-gateway-method)
        *   [Update a payment method of a Payment Gateway](#update-a-payment-method-of-a-payment-gateway)
        *   [Delete a payment method of a Payment Gateway](#delete-a-payment-method-of-a-payment-gateway)
    *   [Paymentmethods](#paymentmethods)
        *   [Paymentmethods property list](#paymentmethods-property-list)
        *   [Retrieve a list of payment methods](#retrieve-a-list-of-payment-methods)
    *   [Paymentmethods paymentproviders](#paymentmethods__paymentproviders)
        *   [Paymentmethods paymentproviders property list](#paymentmethods__paymentproviders-property-list)
        *   [Retrieve a list of providers by payment method](#retrieve-a-list-of-providers-by-payment-method)
        *   [Update the display status of a payment method](#update-the-display-status-of-a-payment-method)
    *   [Paymentservices](#paymentservices)
        *   [Paymentservices property list](#paymentservices-property-list)
        *   [Retrieve a list of PG settings](#retrieve-a-list-of-pg-settings)
    *   [Points setting](#points-setting)
        *   [Points setting property list](#points-setting-property-list)
        *   [Retrieve points settings](#retrieve-points-settings)
        *   [Update points settings](#update-points-settings)
    *   [Policy](#policy)
        *   [Policy property list](#policy-property-list)
        *   [Retrieve a store profile](#retrieve-a-store-profile)
        *   [Update a store profile](#update-a-store-profile)
    *   [Privacy boards](#privacy-boards)
        *   [Privacy boards property list](#privacy-boards-property-list)
        *   [Retrieve privacy policy for posting on board](#retrieve-privacy-policy-for-posting-on-board)
        *   [Update privacy policy for posting on board](#update-privacy-policy-for-posting-on-board)
    *   [Privacy join](#privacy-join)
        *   [Privacy join property list](#privacy-join-property-list)
        *   [Retrieve privacy policy for signup](#retrieve-privacy-policy-for-signup)
        *   [Update privacy policy for signup](#update-privacy-policy-for-signup)
    *   [Privacy orders](#privacy-orders)
        *   [Privacy orders property list](#privacy-orders-property-list)
        *   [Retrieve privacy policy for checkout](#retrieve-privacy-policy-for-checkout)
        *   [Update privacy policy for checkout](#update-privacy-policy-for-checkout)
    *   [Products display setting](#products-display-setting)
        *   [Products display setting property list](#products-display-setting-property-list)
        *   [List all products display setting](#list-all-products-display-setting)
        *   [Update a products display setting](#update-a-products-display-setting)
    *   [Products properties setting](#products-properties-setting)
        *   [Products properties setting property list](#products-properties-setting-property-list)
        *   [Retrieve additional settings for product details](#retrieve-additional-settings-for-product-details)
        *   [Update additional settings for product details](#update-additional-settings-for-product-details)
    *   [Products setting](#products-setting)
        *   [Products setting property list](#products-setting-property-list)
        *   [Retrieve product settings](#retrieve-product-settings)
    *   [Redirects](#redirects)
        *   [Redirects property list](#redirects-property-list)
        *   [Retrieve a list of redirects](#retrieve-a-list-of-redirects)
        *   [Create a redirect](#create-a-redirect)
        *   [Update a redirect](#update-a-redirect)
        *   [Delete a redirect](#delete-a-redirect)
    *   [Restocknotification setting](#restocknotification-setting)
        *   [Restocknotification setting property list](#restocknotification-setting-property-list)
        *   [Retrieve restocknotification settings](#retrieve-restocknotification-settings)
        *   [Updated restocknotification settings](#updated-restocknotification-settings)
    *   [Seo setting](#seo-setting)
        *   [Seo setting property list](#seo-setting-property-list)
        *   [Retrieve SEO settings](#retrieve-seo-settings)
        *   [Update store SEO settings](#update-store-seo-settings)
    *   [Shippingmanager](#shippingmanager)
        *   [Shippingmanager property list](#shippingmanager-property-list)
        *   [Retrieve activation information for Shipping Manager](#retrieve-activation-information-for-shipping-manager)
    *   [Shops](#shops)
        *   [Shops property list](#shops-property-list)
        *   [Retrieve a list of shops](#retrieve-a-list-of-shops)
        *   [Retrieve a shop](#retrieve-a-shop)
    *   [Sms setting](#sms-setting)
        *   [Sms setting property list](#sms-setting-property-list)
        *   [Retrieve SMS settings](#retrieve-sms-settings)
        *   [Update SMS settings](#update-sms-settings)
    *   [Socials apple](#socials-apple)
        *   [Socials apple property list](#socials-apple-property-list)
        *   [Apple login sync details](#apple-login-sync-details)
        *   [Apple login sync settings](#apple-login-sync-settings)
    *   [Socials kakaosync](#socials-kakaosync)
        *   [Socials kakaosync property list](#socials-kakaosync-property-list)
        *   [Kakao Sync details](#kakao-sync-details)
        *   [Kakao Sync updates](#kakao-sync-updates)
    *   [Socials naverlogin](#socials-naverlogin)
        *   [Socials naverlogin property list](#socials-naverlogin-property-list)
        *   [Naver login details](#naver-login-details)
        *   [Update Naver login settings](#update-naver-login-settings)
    *   [Socials navershopping](#socials-navershopping)
        *   [Socials navershopping property list](#socials-navershopping-property-list)
        *   [NAVER Shopping settings](#naver-shopping-settings)
    *   [Store](#store)
        *   [Store property list](#store-property-list)
        *   [Retrieve store details](#retrieve-store-details)
    *   [Store accounts](#store-accounts)
        *   [Store accounts property list](#store-accounts-property-list)
        *   [Retrieve a list of store bank accounts](#retrieve-a-list-of-store-bank-accounts)
    *   [Store dropshipping](#store-dropshipping)
        *   [Store dropshipping property list](#store-dropshipping-property-list)
        *   [Retrieve dropshipping settings](#retrieve-dropshipping-settings)
        *   [Manage dropshipping settings](#manage-dropshipping-settings)
    *   [Store setting](#store-setting)
        *   [Store setting property list](#store-setting-property-list)
        *   [Retrieve store security settings](#retrieve-store-security-settings)
        *   [Edit store security settings](#edit-store-security-settings)
    *   [Subscription shipments setting](#subscription-shipments-setting)
        *   [Subscription shipments setting property list](#subscription-shipments-setting-property-list)
        *   [Retrieve a list of subscription products](#retrieve-a-list-of-subscription-products)
        *   [Create a subscription payment rule](#create-a-subscription-payment-rule)
        *   [Update subscription products](#update-subscription-products)
        *   [Delete subscription products](#delete-subscription-products)
    *   [Taxmanager](#taxmanager)
        *   [Taxmanager property list](#taxmanager-property-list)
        *   [Retrieve activation information for Tax Manager](#retrieve-activation-information-for-tax-manager)
    *   [Users](#users)
        *   [Users property list](#users-property-list)
        *   [Retrieve a list of admin users](#retrieve-a-list-of-admin-users)
        *   [Retrieve admin user details](#retrieve-admin-user-details)
*   #### Product
    
    *   [Bundleproducts](#bundleproducts)
        *   [Bundleproducts property list](#bundleproducts-property-list)
        *   [Retrieve a list of bundles](#retrieve-a-list-of-bundles)
        *   [Retrieve a bundle](#retrieve-a-bundle)
        *   [Create a bundle](#create-a-bundle)
        *   [Update a bundle](#update-a-bundle)
        *   [Delete a bundle](#delete-a-bundle)
    *   [Categories products](#categories__products)
        *   [Categories products property list](#categories__products-property-list)
        *   [Retrieve a list of products by category](#retrieve-a-list-of-products-by-category)
        *   [Retrieve a count of products by category](#retrieve-a-count-of-products-by-category)
        *   [Add products to a category](#add-products-to-a-category)
        *   [Update a product in product category](#update-a-product-in-product-category)
        *   [Delete a product by category](#delete-a-product-by-category)
    *   [Categories properties](#categories-properties)
        *   [Categories properties property list](#categories-properties-property-list)
        *   [Retrieve fields for products in the list](#retrieve-fields-for-products-in-the-list)
        *   [Create a field for product list page](#create-a-field-for-product-list-page)
        *   [Update fields for products in the list](#update-fields-for-products-in-the-list)
    *   [Mains products](#mains__products)
        *   [Mains products property list](#mains__products-property-list)
        *   [Retrieve a list of products in main category](#retrieve-a-list-of-products-in-main-category)
        *   [Retrieve a count of products in main category](#retrieve-a-count-of-products-in-main-category)
        *   [Set main category products](#set-main-category-products)
        *   [Update fixed sorting of products in main category](#update-fixed-sorting-of-products-in-main-category)
        *   [Delete a product in main category](#delete-a-product-in-main-category)
    *   [Mains properties](#mains-properties)
        *   [Mains properties property list](#mains-properties-property-list)
        *   [Retrieve fields for products on the main screen](#retrieve-fields-for-products-on-the-main-screen)
        *   [Create a field for home page](#create-a-field-for-home-page)
        *   [Update fields for products on the main screen](#update-fields-for-products-on-the-main-screen)
    *   [Products](#products)
        *   [Products property list](#products-property-list)
        *   [Retrieve a list of products](#retrieve-a-list-of-products)
        *   [Retrieve a count of products](#retrieve-a-count-of-products)
        *   [Retrieve a product resource](#retrieve-a-product-resource)
        *   [Create a product](#create-a-product)
        *   [Update a product](#update-a-product)
        *   [Delete a product](#delete-a-product)
    *   [Products additionalimages](#products__additionalimages)
        *   [Products additionalimages property list](#products__additionalimages-property-list)
        *   [Create an additional product image](#create-an-additional-product-image)
        *   [Update an additional product image](#update-an-additional-product-image)
        *   [Delete an additional product image](#delete-an-additional-product-image)
    *   [Products approve](#products__approve)
        *   [Products approve property list](#products__approve-property-list)
        *   [Retrieve a product approval status](#retrieve-a-product-approval-status)
        *   [Create a product approval request](#create-a-product-approval-request)
        *   [Update a product approval status](#update-a-product-approval-status)
    *   [Products customproperties](#products__customproperties)
        *   [Products customproperties property list](#products__customproperties-property-list)
        *   [Retrieve user-defined properties by product](#retrieve-user-defined-properties-by-product)
        *   [Update user-defined properties by product](#update-user-defined-properties-by-product)
        *   [Delete user-defined properties by product](#delete-user-defined-properties-by-product)
    *   [Products decorationimages](#products__decorationimages)
        *   [Products decorationimages property list](#products__decorationimages-property-list)
        *   [Retrieve a list of product decoration images](#retrieve-a-list-of-product-decoration-images)
        *   [Set decoration images for a product](#set-decoration-images-for-a-product)
        *   [Update product decoration images](#update-product-decoration-images)
        *   [Remove a product decoration image](#remove-a-product-decoration-image)
    *   [Products discountprice](#products__discountprice)
        *   [Products discountprice property list](#products__discountprice-property-list)
        *   [Retrieve a product discounted price](#retrieve-a-product-discounted-price)
    *   [Products hits](#products__hits)
        *   [Retrieve a count of product views](#retrieve-a-count-of-product-views)
    *   [Products icons](#products__icons)
        *   [Products icons property list](#products__icons-property-list)
        *   [Retrieve a list of product icons](#retrieve-a-list-of-product-icons)
        *   [Set icons for a product](#set-icons-for-a-product)
        *   [Update product icons](#update-product-icons)
        *   [Remove a product icon](#remove-a-product-icon)
    *   [Products images](#products__images)
        *   [Products images property list](#products__images-property-list)
        *   [Upload product images](#upload-product-images)
        *   [Delete product images](#delete-product-images)
    *   [Products memos](#products__memos)
        *   [Products memos property list](#products__memos-property-list)
        *   [Retrieve a list of product memos](#retrieve-a-list-of-product-memos)
        *   [Retrieve a product memo](#retrieve-a-product-memo)
        *   [Create a product memo](#create-a-product-memo)
        *   [Update a product memo](#update-a-product-memo)
        *   [Delete a product memo](#delete-a-product-memo)
    *   [Products options](#products__options)
        *   [Products options property list](#products__options-property-list)
        *   [Retrieve a list of product options](#retrieve-a-list-of-product-options)
        *   [Create product options](#create-product-options)
        *   [Update product options](#update-product-options)
        *   [Delete a product option](#delete-a-product-option)
    *   [Products seo](#products__seo)
        *   [Products seo property list](#products__seo-property-list)
        *   [Retrieve a product's SEO settings](#retrieve-a-product-s-seo-settings)
        *   [Update product SEO settings](#update-product-seo-settings)
    *   [Products tags](#products__tags)
        *   [Products tags property list](#products__tags-property-list)
        *   [Retrieve a count of a product's product tags](#retrieve-a-count-of-a-product-s-product-tags)
        *   [Retrieve a list of a product's product tags](#retrieve-a-list-of-a-product-s-product-tags)
        *   [Create product tags](#create-product-tags)
        *   [Delete a product tag](#delete-a-product-tag)
    *   [Products variants](#products__variants)
        *   [Products variants property list](#products__variants-property-list)
        *   [Retrieve a list of product variants](#retrieve-a-list-of-product-variants)
        *   [Retrieve a product variant](#retrieve-a-product-variant)
        *   [Update a product variant](#update-a-product-variant)
        *   [Update multiple product variants](#update-multiple-product-variants)
        *   [Delete a product variant](#delete-a-product-variant)
    *   [Products variants inventories](#products__variants__inventories)
        *   [Products variants inventories property list](#products__variants__inventories-property-list)
        *   [Retrieve inventory details of a product variant](#retrieve-inventory-details-of-a-product-variant)
        *   [Update a product variant inventory](#update-a-product-variant-inventory)
    *   [Products customproperties](#products-customproperties)
        *   [Products customproperties property list](#products-customproperties-property-list)
        *   [Retrieve user-defined properties](#retrieve-user-defined-properties)
        *   [Create user-defined properties](#create-user-defined-properties)
        *   [Update user-defined properties](#update-user-defined-properties)
        *   [Delete user-defined properties](#delete-user-defined-properties)
    *   [Products decorationimages](#products-decorationimages)
        *   [Products decorationimages property list](#products-decorationimages-property-list)
        *   [Retrieve a list of decoration images](#retrieve-a-list-of-decoration-images)
    *   [Products icons](#products-icons)
        *   [Products icons property list](#products-icons-property-list)
        *   [Retrieve a list of icons](#retrieve-a-list-of-icons)
    *   [Products images](#products-images)
        *   [Products images property list](#products-images-property-list)
        *   [Upload images](#upload-images)
    *   [Products properties](#products-properties)
        *   [Products properties property list](#products-properties-property-list)
        *   [Retrieve fields for product details](#retrieve-fields-for-product-details)
        *   [Create a field for product details page](#create-a-field-for-product-details-page)
        *   [Update fields for product details](#update-fields-for-product-details)
*   #### Order
    
    *   [Cancellation](#cancellation)
        *   [Cancellation property list](#cancellation-property-list)
        *   [Retrieve an order cancellation](#retrieve-an-order-cancellation)
        *   [Create multiple order cancellations](#create-multiple-order-cancellations)
        *   [Change cancellation details in bulk](#change-cancellation-details-in-bulk)
    *   [Cancellationrequests](#cancellationrequests)
        *   [Cancellationrequests property list](#cancellationrequests-property-list)
        *   [Create a cancellation request for multiple items](#create-a-cancellation-request-for-multiple-items)
        *   [Reject a cancellation request for multiple items](#reject-a-cancellation-request-for-multiple-items)
    *   [Cashreceipt](#cashreceipt)
        *   [Cashreceipt property list](#cashreceipt-property-list)
        *   [Retrieve a list of cash receipts](#retrieve-a-list-of-cash-receipts)
        *   [Create a cash receipt](#create-a-cash-receipt)
        *   [Update a cash receipt](#update-a-cash-receipt)
    *   [Cashreceipt cancellation](#cashreceipt__cancellation)
        *   [Cashreceipt cancellation property list](#cashreceipt__cancellation-property-list)
        *   [Update a cash receipt cancellation](#update-a-cash-receipt-cancellation)
    *   [Collectrequests](#collectrequests)
        *   [Collectrequests property list](#collectrequests-property-list)
        *   [Update a collection request](#update-a-collection-request)
    *   [Control](#control)
        *   [Control property list](#control-property-list)
        *   [Order control](#order-control)
    *   [Exchange](#exchange)
        *   [Exchange property list](#exchange-property-list)
        *   [Retrieve an exchange](#retrieve-an-exchange)
        *   [Create multiple exchanges](#create-multiple-exchanges)
        *   [Update multiple order exchanges](#update-multiple-order-exchanges)
    *   [Exchangerequests](#exchangerequests)
        *   [Exchangerequests property list](#exchangerequests-property-list)
        *   [Bulk exchange request API](#bulk-exchange-request-api)
        *   [Reject an exchange request for multiple items](#reject-an-exchange-request-for-multiple-items)
    *   [Fulfillments](#fulfillments)
        *   [Fulfillments property list](#fulfillments-property-list)
        *   [Create shipping information for multiple orders via Fulfillment](#create-shipping-information-for-multiple-orders-via-fulfillment)
    *   [Labels](#labels)
        *   [Labels property list](#labels-property-list)
        *   [Retrieve order labels](#retrieve-order-labels)
        *   [Create multiple order labels](#create-multiple-order-labels)
    *   [Orderform properties](#orderform-properties)
        *   [Orderform properties property list](#orderform-properties-property-list)
        *   [Retrieve an additional checkout field](#retrieve-an-additional-checkout-field)
        *   [Create an additional checkout field](#create-an-additional-checkout-field)
        *   [Update an additional checkout field](#update-an-additional-checkout-field)
        *   [Delete an additional checkout field](#delete-an-additional-checkout-field)
    *   [Orders](#orders)
        *   [Orders property list](#orders-property-list)
        *   [Retrieve a list of orders](#retrieve-a-list-of-orders)
        *   [Retrieve an order](#retrieve-an-order)
        *   [Retrieve a count of orders](#retrieve-a-count-of-orders)
        *   [Update status for multiple orders](#update-status-for-multiple-orders)
        *   [Update an order status](#update-an-order-status)
    *   [Orders autocalculation](#orders__autocalculation)
        *   [Orders autocalculation property list](#orders__autocalculation-property-list)
        *   [Remove auto calculation setting of an order](#remove-auto-calculation-setting-of-an-order)
    *   [Orders buyer](#orders__buyer)
        *   [Orders buyer property list](#orders__buyer-property-list)
        *   [Retrieve customer details of an order](#retrieve-customer-details-of-an-order)
        *   [Update customer information of an order](#update-customer-information-of-an-order)
    *   [Orders buyer history](#orders__buyer-history)
        *   [Orders buyer history property list](#orders__buyer-history-property-list)
        *   [Retrieve a list of customer history of an order](#retrieve-a-list-of-customer-history-of-an-order)
    *   [Orders cancellation](#orders__cancellation)
        *   [Orders cancellation property list](#orders__cancellation-property-list)
        *   [Create an order cancellation](#create-an-order-cancellation)
        *   [Change cancellation details](#change-cancellation-details)
    *   [Orders exchange](#orders__exchange)
        *   [Orders exchange property list](#orders__exchange-property-list)
        *   [Create an order exchange](#create-an-order-exchange)
        *   [Update an order exchange](#update-an-order-exchange)
    *   [Orders exchangerequests](#orders__exchangerequests)
        *   [Orders exchangerequests property list](#orders__exchangerequests-property-list)
        *   [Reject an exchange request](#reject-an-exchange-request)
    *   [Orders items](#orders__items)
        *   [Orders items property list](#orders__items-property-list)
        *   [Retrieve a list of order items](#retrieve-a-list-of-order-items)
        *   [Create an order item](#create-an-order-item)
        *   [Update an order item](#update-an-order-item)
    *   [Orders items labels](#orders__items__labels)
        *   [Orders items labels property list](#orders__items__labels-property-list)
        *   [Retrieve an order label](#retrieve-an-order-label)
        *   [Create an order label](#create-an-order-label)
        *   [Update an order label](#update-an-order-label)
        *   [Delete an order label](#delete-an-order-label)
    *   [Orders items options](#orders__items__options)
        *   [Orders items options property list](#orders__items__options-property-list)
        *   [Create order item options](#create-order-item-options)
        *   [Edit order item options](#edit-order-item-options)
    *   [Orders memos](#orders__memos)
        *   [Orders memos property list](#orders__memos-property-list)
        *   [Retrieve a list of order memos](#retrieve-a-list-of-order-memos)
        *   [Create an order memo](#create-an-order-memo)
        *   [Update an order memo](#update-an-order-memo)
        *   [Delete an order memo](#delete-an-order-memo)
    *   [Orders payments](#orders__payments)
        *   [Orders payments property list](#orders__payments-property-list)
        *   [Update an order payment status](#update-an-order-payment-status)
    *   [Orders paymenttimeline](#orders__paymenttimeline)
        *   [Orders paymenttimeline property list](#orders__paymenttimeline-property-list)
        *   [Retrieve payment history of an order](#retrieve-payment-history-of-an-order)
        *   [Retrieve payment details of an order](#retrieve-payment-details-of-an-order)
    *   [Orders receivers](#orders__receivers)
        *   [Orders receivers property list](#orders__receivers-property-list)
        *   [Retrieve a list of recipients of an order](#retrieve-a-list-of-recipients-of-an-order)
        *   [Update order recipients](#update-order-recipients)
        *   [Change shipping information](#change-shipping-information)
    *   [Orders receivers history](#orders__receivers-history)
        *   [Orders receivers history property list](#orders__receivers-history-property-list)
        *   [Retrieve a list of recipient history of an order](#retrieve-a-list-of-recipient-history-of-an-order)
    *   [Orders refunds](#orders__refunds)
        *   [Orders refunds property list](#orders__refunds-property-list)
        *   [Update an order refund](#update-an-order-refund)
    *   [Orders return](#orders__return)
        *   [Orders return property list](#orders__return-property-list)
        *   [Create an order return](#create-an-order-return)
        *   [Update an order return](#update-an-order-return)
    *   [Orders shipments](#orders__shipments)
        *   [Orders shipments property list](#orders__shipments-property-list)
        *   [Retrieve a list of shipping information of an order](#retrieve-a-list-of-shipping-information-of-an-order)
        *   [Create an order shipping information](#create-an-order-shipping-information)
        *   [Update an order shipping](#update-an-order-shipping)
        *   [Delete an order shipping](#delete-an-order-shipping)
    *   [Orders shippingfeecancellation](#orders__shippingfeecancellation)
        *   [Orders shippingfeecancellation property list](#orders__shippingfeecancellation-property-list)
        *   [Retrieve shipping fee cancellation details of an order](#retrieve-shipping-fee-cancellation-details-of-an-order)
        *   [Create an order shipping fee cancellation](#create-an-order-shipping-fee-cancellation)
    *   [Orders shortagecancellation](#orders__shortagecancellation)
        *   [Orders shortagecancellation property list](#orders__shortagecancellation-property-list)
        *   [Create an order cancellation on stock shortage](#create-an-order-cancellation-on-stock-shortage)
    *   [Orders benefits](#orders-benefits)
        *   [Orders benefits property list](#orders-benefits-property-list)
        *   [Retrieve a list of order benefits applied to an order](#retrieve-a-list-of-order-benefits-applied-to-an-order)
    *   [Orders calculation](#orders-calculation)
        *   [Orders calculation property list](#orders-calculation-property-list)
        *   [Calculate total due](#calculate-total-due)
    *   [Orders coupons](#orders-coupons)
        *   [Orders coupons property list](#orders-coupons-property-list)
        *   [Retrieve a list of coupons applied to an order](#retrieve-a-list-of-coupons-applied-to-an-order)
    *   [Orders dashboard](#orders-dashboard)
        *   [Orders dashboard property list](#orders-dashboard-property-list)
        *   [List all orders dashboard](#list-all-orders-dashboard)
    *   [Orders inflowgroups](#orders-inflowgroups)
        *   [Orders inflowgroups property list](#orders-inflowgroups-property-list)
        *   [Retrieve a list of traffic source groups](#retrieve-a-list-of-traffic-source-groups)
        *   [Create a traffic source group](#create-a-traffic-source-group)
        *   [Update a traffic source group](#update-a-traffic-source-group)
        *   [Delete a traffic source group](#delete-a-traffic-source-group)
    *   [Orders inflowgroups inflows](#orders-inflowgroups__inflows)
        *   [Orders inflowgroups inflows property list](#orders-inflowgroups__inflows-property-list)
        *   [Retrieve a list of group traffic sources](#retrieve-a-list-of-group-traffic-sources)
        *   [Create a group traffic source](#create-a-group-traffic-source)
        *   [Update a group traffic source](#update-a-group-traffic-source)
        *   [Delete a group traffic source](#delete-a-group-traffic-source)
    *   [Orders memos](#orders-memos)
        *   [Orders memos property list](#orders-memos-property-list)
        *   [Retrieve a list of admin memos for an order](#retrieve-a-list-of-admin-memos-for-an-order)
    *   [Orders migrations](#orders-migrations)
        *   [Orders migrations property list](#orders-migrations-property-list)
        *   [Retrieve order from migrated store](#retrieve-order-from-migrated-store)
        *   [Create order from migrated store](#create-order-from-migrated-store)
        *   [Update order from migrated store](#update-order-from-migrated-store)
        *   [Delete order from migrated store](#delete-order-from-migrated-store)
    *   [Orders paymentamount](#orders-paymentamount)
        *   [Orders paymentamount property list](#orders-paymentamount-property-list)
        *   [Retrieve a payment amount](#retrieve-a-payment-amount)
    *   [Orders saleschannels](#orders-saleschannels)
        *   [Orders saleschannels property list](#orders-saleschannels-property-list)
        *   [Retrieve a list of sales channels](#retrieve-a-list-of-sales-channels)
        *   [Create a sales channel](#create-a-sales-channel)
        *   [Update a sales channel](#update-a-sales-channel)
        *   [Delete a sales channel](#delete-a-sales-channel)
    *   [Payments](#payments)
        *   [Payments property list](#payments-property-list)
        *   [Update payment status for multiple orders](#update-payment-status-for-multiple-orders)
    *   [Refunds](#refunds)
        *   [Refunds property list](#refunds-property-list)
        *   [Retrieve a list of refunds](#retrieve-a-list-of-refunds)
        *   [Retrieve a refund](#retrieve-a-refund)
    *   [Reservations](#reservations)
        *   [Reservations property list](#reservations-property-list)
        *   [Retrieve a booked item](#retrieve-a-booked-item)
    *   [Return](#return)
        *   [Return property list](#return-property-list)
        *   [Retrieve a return](#retrieve-a-return)
        *   [Create multiple order returns](#create-multiple-order-returns)
        *   [Update a return](#update-a-return)
    *   [Returnrequests](#returnrequests)
        *   [Returnrequests property list](#returnrequests-property-list)
        *   [Create a return request for multiple items](#create-a-return-request-for-multiple-items)
        *   [Reject a return request for multiple items](#reject-a-return-request-for-multiple-items)
    *   [Shipments](#shipments)
        *   [Shipments property list](#shipments-property-list)
        *   [Create shipping information for multiple orders](#create-shipping-information-for-multiple-orders)
        *   [Update multiple order shippings](#update-multiple-order-shippings)
    *   [Subscription shipments](#subscription-shipments)
        *   [Subscription shipments property list](#subscription-shipments-property-list)
        *   [Retrieve a subscription](#retrieve-a-subscription)
        *   [Create a subscription](#create-a-subscription)
        *   [Update a subscription](#update-a-subscription)
    *   [Subscription shipments items](#subscription-shipments__items)
        *   [Subscription shipments items property list](#subscription-shipments__items-property-list)
        *   [Update product variants in subscription](#update-product-variants-in-subscription)
    *   [Unpaidorders](#unpaidorders)
        *   [Unpaidorders property list](#unpaidorders-property-list)
        *   [Retrieve unpaid orders](#retrieve-unpaid-orders)
*   #### Customer
    
    *   [Customergroups](#customergroups)
        *   [Customergroups property list](#customergroups-property-list)
        *   [Retrieve a list of customer tiers](#retrieve-a-list-of-customer-tiers)
        *   [Retrieve a count of customer tiers](#retrieve-a-count-of-customer-tiers)
        *   [Retrieve a customer tier](#retrieve-a-customer-tier)
    *   [Customergroups customers](#customergroups__customers)
        *   [Customergroups customers property list](#customergroups__customers-property-list)
        *   [Update a customer's customer tier](#update-a-customer-s-customer-tier)
    *   [Customergroups setting](#customergroups-setting)
        *   [Customergroups setting property list](#customergroups-setting-property-list)
        *   [Retrieve customer tier settings](#retrieve-customer-tier-settings)
    *   [Customers](#customers)
        *   [Customers property list](#customers-property-list)
        *   [Retrieve a list of customers](#retrieve-a-list-of-customers)
        *   [Delete an account](#delete-an-account)
    *   [Customers autoupdate](#customers__autoupdate)
        *   [Customers autoupdate property list](#customers__autoupdate-property-list)
        *   [Retrieve customer tier auto-update details](#retrieve-customer-tier-auto-update-details)
    *   [Customers memos](#customers__memos)
        *   [Customers memos property list](#customers__memos-property-list)
        *   [Retrieve a count of customer memos](#retrieve-a-count-of-customer-memos)
        *   [Retrieve a list of customer memos](#retrieve-a-list-of-customer-memos)
        *   [Retrieve a customer memo](#retrieve-a-customer-memo)
        *   [Create a customer memo](#create-a-customer-memo)
        *   [Update a customer memo](#update-a-customer-memo)
        *   [Delete a customer memo](#delete-a-customer-memo)
    *   [Customers paymentinformation](#customers__paymentinformation)
        *   [Customers paymentinformation property list](#customers__paymentinformation-property-list)
        *   [Retrieve a customer's list of payment methods](#retrieve-a-customer-s-list-of-payment-methods)
        *   [Delete customer's payment information](#delete-customer-s-payment-information)
        *   [Delete customer's payment information by payment method ID](#delete-customer-s-payment-information-by-payment-method-id)
    *   [Customers plusapp](#customers__plusapp)
        *   [Customers plusapp property list](#customers__plusapp-property-list)
        *   [Retrieve app installation information](#retrieve-app-installation-information)
    *   [Customers social](#customers__social)
        *   [Customers social property list](#customers__social-property-list)
        *   [Retrieve a customer's social account](#retrieve-a-customer-s-social-account)
    *   [Customers properties](#customers-properties)
        *   [Customers properties property list](#customers-properties-property-list)
        *   [View account signup fields](#view-account-signup-fields)
        *   [Edit account signup fields](#edit-account-signup-fields)
*   #### Community
    
    *   [Boards](#boards)
        *   [Boards property list](#boards-property-list)
        *   [Retrieve a list of boards](#retrieve-a-list-of-boards)
        *   [Retrieve the board settings](#retrieve-the-board-settings)
        *   [Update the board settings](#update-the-board-settings)
    *   [Boards articles](#boards__articles)
        *   [Boards articles property list](#boards__articles-property-list)
        *   [Retrieve a list of posts for a board](#retrieve-a-list-of-posts-for-a-board)
        *   [Create a board post](#create-a-board-post)
        *   [Update a board post](#update-a-board-post)
        *   [Delete a board post](#delete-a-board-post)
    *   [Boards articles comments](#boards__articles__comments)
        *   [Boards articles comments property list](#boards__articles__comments-property-list)
        *   [Retrieve a list of comments for a board post](#retrieve-a-list-of-comments-for-a-board-post)
        *   [Create a comment for a board post](#create-a-comment-for-a-board-post)
        *   [Delete a comment for a board post](#delete-a-comment-for-a-board-post)
    *   [Boards comments](#boards__comments)
        *   [Boards comments property list](#boards__comments-property-list)
        *   [Retrieve comments in bulk](#retrieve-comments-in-bulk)
    *   [Boards seo](#boards__seo)
        *   [Boards seo property list](#boards__seo-property-list)
        *   [Retrieve SEO settings for board](#retrieve-seo-settings-for-board)
        *   [Update SEO settings for board](#update-seo-settings-for-board)
    *   [Commenttemplates](#commenttemplates)
        *   [Commenttemplates property list](#commenttemplates-property-list)
        *   [Retrieve frequently used answers](#retrieve-frequently-used-answers)
        *   [Retrieve a frequently used answer](#retrieve-a-frequently-used-answer)
        *   [Create a frequently used answer](#create-a-frequently-used-answer)
        *   [Update a frequently used answer](#update-a-frequently-used-answer)
        *   [Delete a frequently used answer](#delete-a-frequently-used-answer)
    *   [Financials monthlyreviews](#financials-monthlyreviews)
        *   [Financials monthlyreviews property list](#financials-monthlyreviews-property-list)
        *   [Retrieve the total count for monthly reviews and ratings](#retrieve-the-total-count-for-monthly-reviews-and-ratings)
    *   [Urgentinquiry](#urgentinquiry)
        *   [Urgentinquiry property list](#urgentinquiry-property-list)
        *   [Retrieve an urgent inquiry post](#retrieve-an-urgent-inquiry-post)
    *   [Urgentinquiry reply](#urgentinquiry__reply)
        *   [Urgentinquiry reply property list](#urgentinquiry__reply-property-list)
        *   [Retrieve a reply for urgent inquiry post](#retrieve-a-reply-for-urgent-inquiry-post)
        *   [Create a reply for urgent inquiry post](#create-a-reply-for-urgent-inquiry-post)
        *   [Update a reply for urgent inquiry post](#update-a-reply-for-urgent-inquiry-post)
*   #### Design
    
    *   [Icons](#icons)
        *   [Icons property list](#icons-property-list)
        *   [Retrieve a list of desgin icons](#retrieve-a-list-of-desgin-icons)
        *   [Update store icon settings](#update-store-icon-settings)
    *   [Themes](#themes)
        *   [Themes property list](#themes-property-list)
        *   [Retrieve a list of themes](#retrieve-a-list-of-themes)
        *   [Retrieve a count of themes](#retrieve-a-count-of-themes)
        *   [Retrieve a theme](#retrieve-a-theme)
    *   [Themes pages](#themes__pages)
        *   [Themes pages property list](#themes__pages-property-list)
        *   [Retrieve a theme page](#retrieve-a-theme-page)
        *   [Create a theme page](#create-a-theme-page)
        *   [Update a theme page](#update-a-theme-page)
        *   [Delete a theme page](#delete-a-theme-page)
*   #### Promotion
    
    *   [Benefits](#benefits)
        *   [Benefits property list](#benefits-property-list)
        *   [Retrieve a list of customer benefits](#retrieve-a-list-of-customer-benefits)
        *   [Retrieve a count of customer benefits](#retrieve-a-count-of-customer-benefits)
        *   [Retrieve a customer benefit](#retrieve-a-customer-benefit)
        *   [Create a customer benefit](#create-a-customer-benefit)
        *   [Update a customer benefit](#update-a-customer-benefit)
        *   [Delete a customer benefit](#delete-a-customer-benefit)
    *   [Commonevents](#commonevents)
        *   [Commonevents property list](#commonevents-property-list)
        *   [Retrieve a list of storewide promotions](#retrieve-a-list-of-storewide-promotions)
        *   [Create a storewide promotion](#create-a-storewide-promotion)
        *   [Update a storewide promotion](#update-a-storewide-promotion)
        *   [Delete a storewide promotion](#delete-a-storewide-promotion)
    *   [Coupons](#coupons)
        *   [Coupons property list](#coupons-property-list)
        *   [Retrieve a list of coupons](#retrieve-a-list-of-coupons)
        *   [Retrieve a count of coupons](#retrieve-a-count-of-coupons)
        *   [Create a coupon](#create-a-coupon)
        *   [Coupon management](#coupon-management)
    *   [Coupons issuancecustomers](#coupons__issuancecustomers)
        *   [Coupons issuancecustomers property list](#coupons__issuancecustomers-property-list)
        *   [Retrieve a list of eligible customers for conditional issuance](#retrieve-a-list-of-eligible-customers-for-conditional-issuance)
    *   [Coupons issues](#coupons__issues)
        *   [Coupons issues property list](#coupons__issues-property-list)
        *   [Retrieve a list of issued coupons](#retrieve-a-list-of-issued-coupons)
        *   [Create coupon issuance history](#create-coupon-issuance-history)
    *   [Customerevents](#customerevents)
        *   [Customerevents property list](#customerevents-property-list)
        *   [View member information event](#view-member-information-event)
        *   [Create a member information modification event](#create-a-member-information-modification-event)
        *   [Update information update campaign status](#update-information-update-campaign-status)
    *   [Customers coupons](#customers__coupons)
        *   [Customers coupons property list](#customers__coupons-property-list)
        *   [Retrieve a list of customer coupons](#retrieve-a-list-of-customer-coupons)
        *   [Retrieve a count of customer coupons](#retrieve-a-count-of-customer-coupons)
        *   [Delete a customer coupon](#delete-a-customer-coupon)
    *   [Discountcodes](#discountcodes)
        *   [Discountcodes property list](#discountcodes-property-list)
        *   [Retrieve a list of discount codes](#retrieve-a-list-of-discount-codes)
        *   [Retrieve a discount code](#retrieve-a-discount-code)
        *   [Create a discount code](#create-a-discount-code)
        *   [Update a discount code](#update-a-discount-code)
        *   [Delete a discount code](#delete-a-discount-code)
    *   [Serialcoupons](#serialcoupons)
        *   [Serialcoupons property list](#serialcoupons-property-list)
        *   [Retrieve coupon codes](#retrieve-coupon-codes)
        *   [Generate coupon code](#generate-coupon-code)
        *   [Delete coupon code](#delete-coupon-code)
    *   [Serialcoupons issues](#serialcoupons__issues)
        *   [Serialcoupons issues property list](#serialcoupons__issues-property-list)
        *   [Retrieve a code of coupon codes](#retrieve-a-code-of-coupon-codes)
        *   [Register a code of coupon codes](#register-a-code-of-coupon-codes)
*   #### Application
    
    *   [Apps](#apps)
        *   [Apps property list](#apps-property-list)
        *   [Retrieve an app information](#retrieve-an-app-information)
        *   [Update an app information](#update-an-app-information)
    *   [Appstore orders](#appstore-orders)
        *   [Appstore orders property list](#appstore-orders-property-list)
        *   [Retreive a Cafe24 Store order](#retreive-a-cafe24-store-order)
        *   [Create a Cafe24 Store order](#create-a-cafe24-store-order)
    *   [Appstore payments](#appstore-payments)
        *   [Appstore payments property list](#appstore-payments-property-list)
        *   [Retrieve a list of Cafe24 Store payments](#retrieve-a-list-of-cafe24-store-payments)
        *   [Retrieve a count of Cafe24 Store payments](#retrieve-a-count-of-cafe24-store-payments)
    *   [Databridge logs](#databridge-logs)
        *   [Databridge logs property list](#databridge-logs-property-list)
        *   [Retrieve a list of Databridge webhook logs](#retrieve-a-list-of-databridge-webhook-logs)
    *   [Recipes](#recipes)
        *   [Recipes property list](#recipes-property-list)
        *   [Retrieve a list of recipes](#retrieve-a-list-of-recipes)
        *   [Create a recipe](#create-a-recipe)
        *   [Delete a recipe](#delete-a-recipe)
    *   [Scripttags](#scripttags)
        *   [Scripttags property list](#scripttags-property-list)
        *   [Retrieve a list of script tags](#retrieve-a-list-of-script-tags)
        *   [Retrieve a count of script tags](#retrieve-a-count-of-script-tags)
        *   [Retrieve a script tag](#retrieve-a-script-tag)
        *   [Create a script tag](#create-a-script-tag)
        *   [Update a script tag](#update-a-script-tag)
        *   [Delete a script tag](#delete-a-script-tag)
    *   [Webhooks logs](#webhooks-logs)
        *   [Webhooks logs property list](#webhooks-logs-property-list)
        *   [Retrieve a list of webhook logs](#retrieve-a-list-of-webhook-logs)
    *   [Webhooks setting](#webhooks-setting)
        *   [Webhooks setting property list](#webhooks-setting-property-list)
        *   [Retrieve webhook settings](#retrieve-webhook-settings)
        *   [Edit webhook settings](#edit-webhook-settings)
*   #### Category
    
    *   [Autodisplay](#autodisplay)
        *   [Autodisplay property list](#autodisplay-property-list)
        *   [Retrieve a list of auto layouts](#retrieve-a-list-of-auto-layouts)
        *   [Create auto layout for selected product category](#create-auto-layout-for-selected-product-category)
        *   [Update auto layout for selected product category](#update-auto-layout-for-selected-product-category)
        *   [Delete auto layout for selected product category](#delete-auto-layout-for-selected-product-category)
    *   [Categories](#categories)
        *   [Categories property list](#categories-property-list)
        *   [Retrieve a list of product categories](#retrieve-a-list-of-product-categories)
        *   [Retrieve a count of product categories](#retrieve-a-count-of-product-categories)
        *   [Retrieve a product category](#retrieve-a-product-category)
        *   [Create a product category](#create-a-product-category)
        *   [Update a product category](#update-a-product-category)
        *   [Delete a product category](#delete-a-product-category)
    *   [Categories decorationimages](#categories__decorationimages)
        *   [Categories decorationimages property list](#categories__decorationimages-property-list)
        *   [Retrieve decoration image settings by category](#retrieve-decoration-image-settings-by-category)
        *   [Update decoration images of a product category](#update-decoration-images-of-a-product-category)
    *   [Categories seo](#categories__seo)
        *   [Categories seo property list](#categories__seo-property-list)
        *   [Retrieve SEO settings by category](#retrieve-seo-settings-by-category)
        *   [Update a product category SEO](#update-a-product-category-seo)
    *   [Mains](#mains)
        *   [Mains property list](#mains-property-list)
        *   [Retrieve a list of main categories](#retrieve-a-list-of-main-categories)
        *   [Add main category](#add-main-category)
        *   [Update main category](#update-main-category)
        *   [Delete main category](#delete-main-category)
*   #### Collection
    
    *   [Brands](#brands)
        *   [Brands property list](#brands-property-list)
        *   [Retrieve a list of brands](#retrieve-a-list-of-brands)
        *   [Retrieve a count of brands](#retrieve-a-count-of-brands)
        *   [Create a brand](#create-a-brand)
        *   [Update a brand](#update-a-brand)
        *   [Delete a brand](#delete-a-brand)
    *   [Classifications](#classifications)
        *   [Classifications property list](#classifications-property-list)
        *   [Retrieve a list of custom categories](#retrieve-a-list-of-custom-categories)
        *   [Retrieve a count of custom categories](#retrieve-a-count-of-custom-categories)
    *   [Manufacturers](#manufacturers)
        *   [Manufacturers property list](#manufacturers-property-list)
        *   [Retrieve a list of manufacturers](#retrieve-a-list-of-manufacturers)
        *   [Retrieve a manufacturer](#retrieve-a-manufacturer)
        *   [Retrieve a count of manufacturers](#retrieve-a-count-of-manufacturers)
        *   [Create a manufacturer](#create-a-manufacturer)
        *   [Update a manufacturer](#update-a-manufacturer)
    *   [Origin](#origin)
        *   [Origin property list](#origin-property-list)
        *   [Retrieve a list of origins](#retrieve-a-list-of-origins)
    *   [Trends](#trends)
        *   [Trends property list](#trends-property-list)
        *   [Retrieve a list of trends](#retrieve-a-list-of-trends)
        *   [Retrieve a count of trends](#retrieve-a-count-of-trends)
*   #### Supply
    
    *   [Shipping suppliers](#shipping-suppliers)
        *   [Shipping suppliers property list](#shipping-suppliers-property-list)
        *   [Retrieve a supplier's shipping settings](#retrieve-a-supplier-s-shipping-settings)
        *   [Update a supplier's shipping settings](#update-a-supplier-s-shipping-settings)
    *   [Suppliers](#suppliers)
        *   [Suppliers property list](#suppliers-property-list)
        *   [Retrieve a list of suppliers](#retrieve-a-list-of-suppliers)
        *   [Retrieve a count of suppliers](#retrieve-a-count-of-suppliers)
        *   [Retrieve a supplier](#retrieve-a-supplier)
        *   [Create a supplier](#create-a-supplier)
        *   [Update a supplier](#update-a-supplier)
        *   [Delete a supplier](#delete-a-supplier)
    *   [Suppliers users](#suppliers-users)
        *   [Suppliers users property list](#suppliers-users-property-list)
        *   [Retrieve a list of supplier users](#retrieve-a-list-of-supplier-users)
        *   [Retrieve a count of supplier users](#retrieve-a-count-of-supplier-users)
        *   [Retrieve supplier user details](#retrieve-supplier-user-details)
        *   [Create a supplier user](#create-a-supplier-user)
        *   [Update a supplier user](#update-a-supplier-user)
        *   [Delete a supplier user](#delete-a-supplier-user)
    *   [Suppliers users regionalsurcharges](#suppliers-users__regionalsurcharges)
        *   [Suppliers users regionalsurcharges property list](#suppliers-users__regionalsurcharges-property-list)
        *   [Retrieve a supplier user's list of regional shipping fees](#retrieve-a-supplier-user-s-list-of-regional-shipping-fees)
        *   [Create regional shipping fee for a supplier user](#create-regional-shipping-fee-for-a-supplier-user)
        *   [Delete supplier user's regional shipping fee settings](#delete-supplier-user-s-regional-shipping-fee-settings)
    *   [Suppliers users regionalsurcharges setting](#suppliers-users__regionalsurcharges-setting)
        *   [Suppliers users regionalsurcharges setting property list](#suppliers-users__regionalsurcharges-setting-property-list)
        *   [Retrieve a supplier user's regional shipping fee settings](#retrieve-a-supplier-user-s-regional-shipping-fee-settings)
        *   [Update a supplier user's regional shipping fee settings](#update-a-supplier-user-s-regional-shipping-fee-settings)
*   #### Shipping
    
    *   [Carriers](#carriers)
        *   [Carriers property list](#carriers-property-list)
        *   [Retrieve a list of shipping carriers](#retrieve-a-list-of-shipping-carriers)
        *   [Retrieve a shipping carrier](#retrieve-a-shipping-carrier)
        *   [Create a shipping carrier](#create-a-shipping-carrier)
        *   [Update a shipping carrier](#update-a-shipping-carrier)
        *   [Delete a shipping carrier](#delete-a-shipping-carrier)
    *   [Regionalsurcharges](#regionalsurcharges)
        *   [Regionalsurcharges property list](#regionalsurcharges-property-list)
        *   [Retrieve shipping zone rates settings](#retrieve-shipping-zone-rates-settings)
        *   [Update regional surcharges](#update-regional-surcharges)
    *   [Shipping](#shipping)
        *   [Shipping property list](#shipping-property-list)
        *   [Retrieve shipping / return settings](#retrieve-shipping-return-settings)
        *   [Update store shipping/return settings](#update-store-shipping-return-settings)
    *   [Shipping additionalfees](#shipping-additionalfees)
        *   [Shipping additionalfees property list](#shipping-additionalfees-property-list)
        *   [Retrieve a list of applicable countries for additional handling fee on international shipping](#retrieve-a-list-of-applicable-countries-for-additional-handling-fee-on-international-shipping)
    *   [Shippingorigins](#shippingorigins)
        *   [Shippingorigins property list](#shippingorigins-property-list)
        *   [Retrieve a list of shipping origins](#retrieve-a-list-of-shipping-origins)
        *   [Retrieve a shipping origin](#retrieve-a-shipping-origin)
        *   [Create a shipping origin](#create-a-shipping-origin)
        *   [Update a shipping origin](#update-a-shipping-origin)
        *   [Delete a shipping origin](#delete-a-shipping-origin)
*   #### Salesreport
    
    *   [Financials dailysales](#financials-dailysales)
        *   [Financials dailysales property list](#financials-dailysales-property-list)
        *   [Retrieve a list of daily sales](#retrieve-a-list-of-daily-sales)
    *   [Financials monthlysales](#financials-monthlysales)
        *   [Financials monthlysales property list](#financials-monthlysales-property-list)
        *   [Retrieve a list of monthly sales](#retrieve-a-list-of-monthly-sales)
    *   [Reports hourlysales](#reports-hourlysales)
        *   [Reports hourlysales property list](#reports-hourlysales-property-list)
        *   [Retrieve hourly sales statistics of a store](#retrieve-hourly-sales-statistics-of-a-store)
    *   [Reports productsales](#reports-productsales)
        *   [Reports productsales property list](#reports-productsales-property-list)
        *   [Retrieve hourly product sales statistics of a store](#retrieve-hourly-product-sales-statistics-of-a-store)
    *   [Reports salesvolume](#reports-salesvolume)
        *   [Reports salesvolume property list](#reports-salesvolume-property-list)
        *   [Retrieve a sales report](#retrieve-a-sales-report)
*   #### Personal
    
    *   [Carts](#carts)
        *   [Carts property list](#carts-property-list)
        *   [Retrieve a shopping cart](#retrieve-a-shopping-cart)
    *   [Customers wishlist](#customers__wishlist)
        *   [Customers wishlist property list](#customers__wishlist-property-list)
        *   [Retrieve a count of products in customer wishlist](#retrieve-a-count-of-products-in-customer-wishlist)
        *   [Retrieve a list of products in customer wishlist](#retrieve-a-list-of-products-in-customer-wishlist)
    *   [Products carts](#products__carts)
        *   [Products carts property list](#products__carts-property-list)
        *   [Retrieve a count of carts containing a product](#retrieve-a-count-of-carts-containing-a-product)
        *   [Retrieve a list of carts containing a product](#retrieve-a-list-of-carts-containing-a-product)
*   #### Privacy
    
    *   [Customersprivacy](#customersprivacy)
        *   [Customersprivacy property list](#customersprivacy-property-list)
        *   [Retrieve a list of customer information](#retrieve-a-list-of-customer-information)
        *   [Retrieve a count of customer information](#retrieve-a-count-of-customer-information)
        *   [Retrieve a customer information](#retrieve-a-customer-information)
        *   [Update a customer information](#update-a-customer-information)
    *   [Products wishlist customers](#products__wishlist-customers)
        *   [Products wishlist customers property list](#products__wishlist-customers-property-list)
        *   [Retrieve a list of customers with a product in wishlist](#retrieve-a-list-of-customers-with-a-product-in-wishlist)
        *   [Retrieve a count of customers with a product in wishlist](#retrieve-a-count-of-customers-with-a-product-in-wishlist)
*   #### Mileage
    
    *   [Credits](#credits)
        *   [Credits property list](#credits-property-list)
        *   [Retrieve a list of credits by date range](#retrieve-a-list-of-credits-by-date-range)
    *   [Credits report](#credits-report)
        *   [Credits report property list](#credits-report-property-list)
        *   [Retrieve a credit report by date range](#retrieve-a-credit-report-by-date-range)
    *   [Points](#points)
        *   [Points property list](#points-property-list)
        *   [Retrieve points](#retrieve-points)
        *   [Issue and deduct points](#issue-and-deduct-points)
    *   [Points autoexpiration](#points-autoexpiration)
        *   [Points autoexpiration property list](#points-autoexpiration-property-list)
        *   [Retrieve an automatic points expiration](#retrieve-an-automatic-points-expiration)
        *   [Create an automatic points expiration](#create-an-automatic-points-expiration)
        *   [Delete an automatic points expiration](#delete-an-automatic-points-expiration)
    *   [Points report](#points-report)
        *   [Points report property list](#points-report-property-list)
        *   [Retrieve a points report by date range](#retrieve-a-points-report-by-date-range)
*   #### Notification
    
    *   [Automails](#automails)
        *   [Automails property list](#automails-property-list)
        *   [Retrieve automated email settings](#retrieve-automated-email-settings)
        *   [Update automated email settings](#update-automated-email-settings)
    *   [Customers invitation](#customers__invitation)
        *   [Customers invitation property list](#customers__invitation-property-list)
        *   [Send an invitation to activate account](#send-an-invitation-to-activate-account)
    *   [Recipientgroups](#recipientgroups)
        *   [Recipientgroups property list](#recipientgroups-property-list)
        *   [Retrieve distribution group list](#retrieve-distribution-group-list)
        *   [Retrieve distribution group details](#retrieve-distribution-group-details)
        *   [Create a distribution group](#create-a-distribution-group)
        *   [Edit distribution group](#edit-distribution-group)
        *   [Delete distribution group](#delete-distribution-group)
    *   [Sms](#sms)
        *   [Sms property list](#sms-property-list)
        *   [Send a SMS](#send-a-sms)
    *   [Sms balance](#sms-balance)
        *   [Sms balance property list](#sms-balance-property-list)
        *   [Retrieve the SMS balance](#retrieve-the-sms-balance)
    *   [Sms receivers](#sms-receivers)
        *   [Sms receivers property list](#sms-receivers-property-list)
        *   [Retrieve a SMS recipient](#retrieve-a-sms-recipient)
    *   [Sms senders](#sms-senders)
        *   [Sms senders property list](#sms-senders-property-list)
        *   [Retrieve a list of SMS senders](#retrieve-a-list-of-sms-senders)
*   #### Translation
    
    *   [Translations categories](#translations-categories)
        *   [Translations categories property list](#translations-categories-property-list)
        *   [Retrieve a list of product category translations](#retrieve-a-list-of-product-category-translations)
        *   [Update product category translation](#update-product-category-translation)
    *   [Translations products](#translations-products)
        *   [Translations products property list](#translations-products-property-list)
        *   [Retrieve a list of product translations](#retrieve-a-list-of-product-translations)
        *   [Update product translation](#update-product-translation)
    *   [Translations store](#translations-store)
        *   [Translations store property list](#translations-store-property-list)
        *   [Retrieve a list of store translations](#retrieve-a-list-of-store-translations)
        *   [Update the translations of a store](#update-the-translations-of-a-store)
    *   [Translations themes](#translations-themes)
        *   [Translations themes property list](#translations-themes-property-list)
        *   [Retrieve a list of theme translations](#retrieve-a-list-of-theme-translations)
        *   [Retrieve a theme translation](#retrieve-a-theme-translation)
        *   [Update a theme translation](#update-a-theme-translation)
*   #### Analytics
    
    *   [Financials dailyvisits](#financials-dailyvisits)
        *   [Financials dailyvisits property list](#financials-dailyvisits-property-list)
        *   [Retrieve a count of dailyvisits](#retrieve-a-count-of-dailyvisits)

  

API 버전 선택

한국어

*   [한국어](/docs/api/admin)
*   [日本語](/docs/ja/api/admin)
*   [English](/docs/en/api/admin)

API version: 2025-12-01 (latest)

# non-print

## API Index

*   [**상점** Store](#store)
*   [**상품** Product](#products)
*   [**주문** Order](#orders)
*   [**회원** Customer](#customers)
*   [**게시판** Community](#boards)
*   [**디자인** Design](#themes)
*   [**프로모션** Promotion](#benefits)
*   [**앱** Application](#apps)
*   [**상품분류** Category](#categories)
*   [**판매분류** Collection](#brands)
*   [**공급사 정보** Supply](#suppliers)
*   [**배송** Shipping](#carriers)
*   [**매출통계** Salesreport](#reports-salesvolume)
*   [**개인화정보** Personal](#customers-wishlist)
*   [**개인정보** Privacy](#customersprivacy)
*   [**적립금** Mileage](#points)
*   [**알림** Notification](#sms)
*   [**번역** Translation](#translations-categories)
*   [**접속통계** Analytics](#financials-dailyvisits)

## Introduction

### Cafe24 API[](#cafe24-api)

카페24 쇼핑몰 API는 카페24 쇼핑몰에 연동하여 서비스를 제공하기 위한 앱스토어 입점 개발사, 서드파티 솔루션 제공자 등에 제공하는 API입니다.

카페24 API는 RESTful한 아키텍쳐로서 OAuth 2.0 기반의 인증 시스템과 표준 HTTP Request Method, 리소스를 예측할 수 있는 엔드포인트 URL, HTTP 코드 기반의 에러 메시지를 제공합니다.

### API Diagram[](#api-diagram)

리소스 관계를 다이어그램으로 제공하여, 전체적인 카페24 API 체계를 확인할 수 있습니다.

[![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Admin_API_Diagram.png)](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Admin_API_Diagram.png)

### Request/Response Format[](#request-response-format)

*   API 요청과 응답은 JSON Format을 지원합니다.
    
*   개인정보 보호를 위하여 카페24 API는 HTTPS 프로토콜만 지원합니다.
    
*   Dates 속성은 [ISO\_8601 ![](../assets/images/desktop/shortcut_icon.png)](https://en.wikipedia.org/wiki/ISO_8601) Format으로 제공합니다. : YYYY-MM-DDTHH:MM:SS+09:00
    

> 요청 예제 (조회) cURL Java Python Node.js PHP Go

> 요청 예제 (등록/수정) cURL Java Python Node.js PHP Go

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
    

### Admin API Intro[](#admin-api-intro)

Admin API는 쇼핑몰 관리자가 쇼핑몰의 정보를 조회하거나 생성, 수정, 삭제하는데 적합합니다. Admin API는 해당 리소스의 정보를 대부분 조회할 수 있으며 OAuth 2.0 방식의 별도 인증을 통과한 경우에만 사용할 수 있습니다.

> 사용 예시

```
https://{mallid}.cafe24api.com/api/v2/admin/sampleapi
```

### API Status Code[](#api-status-code)

| Code | 발생하는 사례 | 오류 해결 방법 |
| --- | --- | --- |
| 200 | GET 성공, PUT 성공, DELETE 성공시 |  |
| 201 | POST 성공시 |  |
| 207 | 다중 요청 등록시 상태가 객체별로 다른 경우 | 오류 상태를 객체별로 확인하여 해당 상태에 따라 대응합니다. |
| 400 | 서버에서 요청을 이해할 수 없음  
1) Content-Type이 잘못 지정되어있음  
2) application/type이 json이 아님 | 요청시 "Content-Type"이 application/json으로 되어있는지 확인합니다. |
| 400 | 요청 API URL에 한글 또는 특수문자를 인코딩하지 않고 그대로 사용한 경우 | 요청 API URL에 한글 또는 특수문자를 URL 인코딩하였는지 확인합니다. |
| 401 | 1) Access Token 없이 호출한 경우  
2) Access Token이 유효하지 않은 경우  
3) Access Token이 만료된 경우  
4) 알 수 없는 클라이언트일 경우 | 유효한 발급 절차에 따라 발급받은 Access Token을 사용하였는지 확인합니다. |
| 401 | Front API 사용시 client\_id를 미입력한 경우 | 유효한 클라이언트 ID를 사용하였는지 확인합니다. |
| 403 | 1) Access Token은 있으나 해당 Scope에 권한이 없음  
2) Front API에서 볼 수 있는 권한이 없을 경우 | API를 호출할 수 있는 권한이 있는지 API의 Scope 또는 쇼핑몰의 설정을 확인합니다. |
| 403 | https 프로토콜이 아닌 경우 | API 요청시 https 로 요청하였는지 확인합니다. |
| 403 | 뉴상품 쇼핑몰이 아닌 경우 | 쇼핑몰이 (뉴)상품관리로 업그레이드 되어야 사용 가능합니다. |
| 403 | (Admin API 호출시) 쇼핑몰에서 해당 앱이 삭제된 경우 | 쇼핑몰에 앱이 설치되었는지 확인 후 앱을 다시 설치합니다. |
| 403 | (Front API 호출시) 쇼핑몰에서 해당 앱이 삭제된 경우 | 쇼핑몰에 앱이 설치되었는지 확인 후 앱을 다시 설치합니다. |
| 403 | (Customer API 호출시) 쇼핑몰에서 해당 앱이 삭제된 경우 | 쇼핑몰에 앱이 설치되었는지 확인 후 앱을 다시 설치합니다. |
| 404 | 1) API URL을 잘못 호출한 경우  
2) 리소스를 찾을 수 없을 경우  
3) {#id}가 없는 경우 | 엔드포인트 URL의 오류가 있는지 API 문서를 참고하여 확인합니다. |
| 409 | 동일 리소스에 동일 내용을 업데이트할 경우 | 수정할 데이터를 요청해주세요. |
| 422 | 조회/처리 요청시 값이 정해진 스펙과 다를 경우  
1) 필수 파라메터 누락함  
2) 정해진 스펙과 다를 경우 | API 문서를 참고하여 필수 파라메터가 입력되지 않았거나 유효하지 않은 값을 입력하였는지 확인합니다. |
| 429 | 클라이언트의 API 요청이 Bucket을 초과한 경우 | API 최대 허용 요청 건수를 초과하지 않도록 잠시 후 다시 요청합니다. |
| 500 | 내부 서버 에러, 알 수 없는 에러 | 일시적으로 에러가 발생하였습니다. 잠시 후에 다시 시도합니다. |
| 503 | 현재 서버가 다운된 경우 | 개발자센터로 문의해주세요. |
| 503 | 서버가 다운된 경우. API를 사용할 수 없음. | 개발자센터로 문의해주세요. |
| 504 | 요청 시간이 초과된 경우(Timeout) | 일시적으로 에러가 발생하여 응답이 지연되고 있습니다. 잠시 후에 다시 시도해주세요. |

### How to use GET API[](#how-to-use-get-api)

카페24 API는 데이터를 조회하는 여러가지 방법을 제공하고 있습니다.

다음은 API 조회시 여러가지 파라메터를 사용하여 다양하게 데이터를 호출할 수 있는 방법을 설명하고 있습니다.

#### 1\. 검색조건 추가

검색조건은 엔드포인트에 파라메터를 추가하여 검색할 수 있습니다.

여러 조건을 같이 검색할 경우 "&" 구분자를 이용하여 검색 조건을 추가할 수 있습니다.

API에서 지원하는 경우, 타임존을 사용하여 날짜와 시간 검색을 할 수 있습니다.

> 검색조건 추가
> 
> ```
> 예) 특정 브랜드 내에서 상품 판매가가 1000원 이상인 상품 조회
> GET https://{mallid}.cafe24api.com/api/v2/admin/products?brand_code=B000000A&price_min=1000
> ```

예) 상품 등록일 범위를 지정하여 상품 조회 GET https://{mallid}.cafe24api.com/api/v2/admin/products?created\_start\_date=2018-01-03&created\_end\_date=2018-02-03

예) 상품 수정일 범위를 지정하여 상품 조회 GET https://{mallid}.cafe24api.com/api/v2/admin/products?updated\_start\_date=2018-01-03T14:01:26+09:00&updated\_end\_date=2018-02-03T14:01:26+09:00 \`\`\`

#### 2\. 콤마로 여러 건을 검색

API에서 지원하는 경우, 콤마(,)를 사용하여 여러 값을 동시에 검색할 수 있습니다. (단, 100개 항목 이하로 입력 해주세요.)

콤마(,)로 추가한 검색 조건은 OR 조건으로, 검색 조건에 해당되는 모든 값들이 검색됩니다.

> 콤마로 여러 건을 검색

```
예) 특정 상품번호를 지정하여 상품 조회
GET https://{mallid}.cafe24api.com/api/v2/admin/products?product_no=11,12,13

예) 특정 상품번호와 상품코드를 지정하여 상품 조회
GET https://{mallid}.cafe24api.com/api/v2/admin/products?product_no=11,12,13&product_code=P000000X,P000000W
```

#### 3\. 멀티쇼핑몰 정보 조회

특정 멀티쇼핑몰 번호를 명시하면 해당 멀티쇼핑몰의 정보를 조회할 수 있습니다.

멀티쇼핑몰 번호를 명시하지 않을 경우, 기본 쇼핑몰의 정보를 조회합니다.

> 멀티쇼핑몰 정보 조회

```
예) 특정 멀티쇼핑몰의 상품 조회
GET https://{mallid}.cafe24api.com/api/v2/admin/products?shop_no=2
```

#### 4\. 상세 조회와 단건 조회

리소스의 ID를 명시하여 상세 조회를 할 수 있습니다.

상세 조회는 리소스 하나만 조회할 수 있지만, 목록 조회보다 더 많은 항목이 반환됩니다.

> 상세 조회와 단건 조회

```
예) 특정 상품번호를 지정하여 상품 상세 조회
GET https://{mallid}.cafe24api.com/api/v2/admin/products/128


예) 특정 상품번호를 지정하여 상품 단건 조회
GET https://{mallid}.cafe24api.com/api/v2/admin/products?product_no=128
```

#### 5\. Pagination

조회 결과가 많을 경우, 정해진 'limit' 기본 값만큼 결과가 조회됩니다.

'limit' 파라메터를 이용하여 조회 건수를 확장할 수 있으며, API마다 정의된 최대 값만큼만 확장할 수 있습니다.

'limit' 최대 값으로 모든 데이터를 조회할 수 없는 경우, 'offset' 파라메터를 사용할 수 있습니다.

> Pagination

```
예 ) 상품 100개 조회
GET https://{mallid}.cafe24api.com/api/v2/admin/products?limit=100


예) 201번째 상품부터 300번째 상품까지 조회
GET https://{mallid}.cafe24api.com/api/v2/admin/products?limit=100&offset=200
```

#### 6\. 특정 항목 조회

특정한 값들만 조회하고 싶을 때는 'fields' 파라메터를 사용하여 조회할 수 있습니다.

> 특정 항목 조회

```
예) 상품명과 상품번호 항목만 조회
GET https://{mallid}.cafe24api.com/api/v2/admin/products?fields=product_name,product_no
```

#### 7\. 하위 리소스 조회

API에서 지원하는 경우, 'embed' 파라메터를 사용하여 하위 리소스의 데이터를 같이 조회할 수 있습니다.

> 하위 리소스 조회

```
예) 상품 조회시 품목과 재고 데이터를 함께 조회
GET https://{mallid}.cafe24api.com/api/v2/admin/products/570?embed=variants,inventories
```

### API Limit[](#api-limit)

카페24 API는 안정적인 응답 속도와 플랫폼 전체의 가용성을 보장하기 위해, 요청 수 제한 정책과 사용량 제한 정책을 병행 적용합니다.

#### 요청 수 제한

카페24 API는 "Leaky Bucket" 알고리즘으로 작동합니다. Leaky Bucket 알고리즘은 성능을 위해 비정상적으로 많은 API 요청만 제한되고 일상적인 API 요청은 별다른 제약 없이 사용할 수 있는 효과가 있습니다.제한되고 일상적인 API 요청은 별다른 제약 없이 사용할 수 있는 효과가 있습니다.

카페24 API는 API 요청을 Bucket에 쌓아둡니다. Bucket은 쇼핑몰 당 "호출건 수 제한"만큼 가득차면 API 호출이 제한됩니다. Bucket은 1초에 2회씩 감소하며, 감소한만큼 다시 API 호출을 할 수 있습니다.

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

> 예시 코드 (요청) cURL Java Python Node.js PHP Go

## Authentication

### Get Authentication Code[](#get-authentication-code)

토큰발급 요청시 사용된 code는 재사용할 수 없으며 코드 발급 후 1분이 경과하면 만료됩니다.

*   {mallid} : 해당 쇼핑몰ID를 입력합니다.
    
*   {client\_id} : 개발자 센터에서 생성한 앱의 client\_id를 입력합니다.
    
*   {state} : 위변조 방지를 위해 입력하는 값으로 코드 반환시 같은 값이 반환됩니다.
    
*   {redirect\_uri} : 개발자 센터에서 생성한 앱의 Redirect URL을 입력합니다.
    
*   {scope} : 해당 접근 토큰으로 접근할 리소스 서버의 권한을 입력할 수 있습니다.
    

접근 토큰을 발급 받으려면 면저 접근 코드를 요청해야 합니다. 접근 코드는 클라이언트가 웹 애플리케이션 형태일 경우 이용됩니다. 코드 요청은 cURL이 아닌 웹브라우저에서 진행하셔야 합니다.

> 예시 코드 (요청)

```
GET 'https://{mallid}.cafe24api.com/api/v2/oauth/authorize?response_type=code&client_id={client_id}&state={state}&redirect_uri={redirect_uri}&scope={scope}'
```

> 예시 코드 (응답)

```
HTTP/1.1 302 Found
Location: {redirect_uri}?code={authorize_code}&state={state}
```

### Get Access Token[](#get-access-token)

발급 받은 인증 코드를 사용하여 실제로 API를 호출할 수 있는 사용자 토큰(Access Token, Refresh Token)을 받아 올 수 있습니다.

*   {mallid} : 해당 쇼핑몰ID를 입력합니다.
    
*   {client\_id} : 개발자 센터에서 생성한 앱의 client\_id를 입력합니다.
    
*   {client\_secret} : 개발자 센터에서 생성한 앱의 client\_secret을 입력합니다.
    
*   {code} : 발급받은 코드를 입력합니다.
    
*   {redirect\_uri} : 개발자 센터에서 생성한 앱의 Redirect URL을 입력합니다.
    

access\_token : 접근 토큰으로서 클라이언트가 리소스 서버에 접근시 사용됩니다.

refresh\_token : 접근 토큰 만료 후 재발급을 위해 사용하는 토큰입니다.

> 예시 코드 (요청) cURL Java Python Node.js PHP Go

> 예시 코드 (응답)

```
HTTP/1.1 200 OK
{
    "access_token": "0iqR5nM5EJIq..........",
    "expires_at": "2021-03-01T14:00:00.000",
    "refresh_token": "JeTJ7XpnFC0P..........",
    "refresh_token_expires_at": "2021-03-15T12:00:00.000",
    "client_id": "BrIfqEKoPxeE..........",
    "mall_id": "yourmall",
    "user_id": "test",
    "scopes": [
        "mall.read_order",
        "mall.read_product",
        "mall.read_store",
        "...etc...",
    ],
    "issued_at": "2021-03-01T12:00:00.000",
    "shop_no": "1",
    "token_type": "Bearer"
}
```

### Get Access Token using refresh token[](#get-access-token-using-refresh-token)

접근 토큰은 발급 받은 후 2시간이 지나면 사용할 수 없습니다. 접근 토큰이 만료된 후 다시 재발급을 받아야 리소스 서버에 접근할 수 있습니다. 이미 접근 토큰을 발급 받았다면 refresh\_token를 사용하여 접근 토큰을 재발급 받을수 있습니다.

refresh token은 2주간 유효하며, refresh token 만료전에 요청을 하면 갱신된 access token과 갱신된 refresh token이 함께 반환됩니다. 기존 refresh token은 만료처리되어 사용할 수 없습니다.

발급 받은 인증 코드를 사용하여 실제로 API를 호출할 수 있는 사용자 토큰(Access Token, Refresh Token)을 받아 올 수 있습니다.

*   {mallid} : 해당 쇼핑몰ID를 입력합니다.
    
*   {client\_id} : 개발자 센터에서 생성한 앱의 client\_id를 입력합니다.
    
*   {client\_secret} : 개발자 센터에서 생성한 앱의 client\_secret을 입력합니다.
    
*   {refresh\_token} : 토큰 발급시 받은 refresh\_token을 입력합니다.
    

access\_token : 접근 토큰으로서 클라이언트가 리소스 서버에 접근시 사용됩니다.

refresh\_token : 접근 토큰 만료 후 재발급을 위해 사용하는 토큰입니다.

> 예시 코드 (요청) cURL Java Python Node.js PHP Go

> 예시 코드 (응답)

```
HTTP/1.1 200 OK
{
    "access_token": "21EZes0dGSfN..........",
    "expires_at": "2021-03-01T15:50:00.000",
    "refresh_token": "xLlhWztQHBik............",
    "refresh_token_expires_at": "2021-03-15T13:50:00.000",
    "client_id": "BrIfqEKoPxeE..........",
    "mall_id": "yourmall",
    "user_id": "test",
    "scopes": [
        "mall.read_order",
        "mall.read_product",
        "mall.read_store",
        "...etc...",
    ],
    "issued_at": "2021-03-01T13:50:00.000",
    "shop_no": "1",
    "token_type": "Bearer"
}
```

### Revoke Access Token[](#revoke-access-token)

Access Token을 사용하여 직접 토큰을 폐기할 수 있습니다.

요청한 토큰에 해당하는 리프레시 토큰도 함께 폐기됩니다.

*   {mallid} : 해당 쇼핑몰ID를 입력합니다.
    
*   {client\_id} : 개발자 센터에서 생성한 앱의 client\_id를 입력합니다.
    
*   {client\_secret} : 개발자 센터에서 생성한 앱의 client\_secret을 입력합니다.
    
*   {token} : 토큰 발급시 받은 access\_token 또는 refresh\_token, id\_token 입력합니다.
    
*   {token\_hint} : 토큰이 access\_token이면 access\_token, refresh\_token이면 refresh\_token, id\_token이면 id\_token 입력합니다.
    

> 예시 코드 (요청) cURL Java Python Node.js PHP Go

> 예시 코드 (응답)

```
HTTP/1.1 200 OK
```

# Store

## Activitylogs

활동로그(Activitylog)는 쇼핑몰 관리자가 쇼핑몰 어드민에서 진행한 운영 활동을 기록한 내역입니다.  
활동로그 리소스를 사용하면 쇼핑몰의 활동로그를 생성하거나 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/activitylogs
GET /api/v2/admin/activitylogs/{process_no}
```

#### \[더보기 상세 내용\]

### Activitylogs property list[](#activitylogs-property-list)

| **Attribute** | **Description** |
| --- | --- |
| process\_no | 
업무처리 넘버

 |
| mode | 

모드

P : PC 어드민  
M : 모바일 어드민  
S : (구)스마트모드

 |
| type | 

구분

 |
| content | 

업무내용

 |
| process\_date | 

처리일시

 |
| manager\_id  

_형식 : \[a-z0-9\]_  
_글자수 최소: \[4자\]~최대: \[16자\]_

 | 

처리자

 |
| manager\_type | 

처리자 타입

 |

### Retrieve a list of action logs [](#retrieve-a-list-of-action-logs)cafe24

GET /api/v2/admin/activitylogs

###### GET

활동로그를 목록으로 조회할 수 있습니다.  
운영 활동을 한 사람이 누구인지, 어떤 메뉴에서 언제 진행했는지 확인할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| manager\_type | 
처리자 타입

P : 대표운영자  
A : 부운영자  
S : 공급사

 |
| manager\_id  

_형식 : \[a-z0-9\]_  
_글자수 최소: \[4자\]~최대: \[16자\]_

 | 

처리자

 |
| mode | 

모드

P : PC 어드민  
M : 모바일 어드민  
S : (구)스마트모드

 |
| type | 

구분

 |
| content  

_최대글자수 : \[500자\]_

 | 

업무내용

 |
| **start\_date**  
**Required**  

_날짜_

 | 

검색 시작일

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve a list of action logs

*   [Retrieve a list of action logs](#none)
*   [Retrieve activitylogs with fields parameter](#none)
*   [Retrieve a specific activitylogs with mode parameter](#none)
*   [Retrieve activitylogs using paging](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve an action log [](#retrieve-an-action-log)cafe24

GET /api/v2/admin/activitylogs/{process\_no}

###### GET

활동로그를 상세 조회할 수 있습니다.  
운영 활동을 한 사람이 누구인지, 어떤 메뉴에서 언제 진행했는지 확인할 수 있으며, content를 통해 진행한 내역을 상세하게 확인할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **process\_no**  
**Required** | 
업무처리 넘버

 |

Retrieve an action log

*   [Retrieve an action log](#none)
*   [Retrieve an activitylog with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Automessages arguments

자동메시지 변수(Automessages arguments)는 자동메시지 발신 시 사용할 수 있는 변수를 확인하는 리소스입니다.

> Endpoints

```
GET /api/v2/admin/automessages/arguments
```

#### \[더보기 상세 내용\]

### Automessages arguments property list[](#automessages-arguments-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| name | 

변수명

 |
| description | 

변수 설명

 |
| sample | 

변수 예제

 |
| string\_length | 

메시지 표시 최대 글자수

글자수 : 설정된 글자수 만큼 표시  
가변 : 글자수 제한 없이 모두 표시

 |
| send\_case | 

사용 가능 발송 상황

 |

### Retrieve the list of available variables for automated messages [](#retrieve-the-list-of-available-variables-for-automated-messages)cafe24 youtube

GET /api/v2/admin/automessages/arguments

###### GET

자동메시지 발송 설정내역을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve the list of available variables for automated messages

*   [Retrieve the list of available variables for automated messages](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Automessages setting

자동메시지 설정(Automessages setting)은 메시지 자동 발송 시 사용 중인 발송 수단을 확인 및 어떤 발송 수단으로 우선발송할 지 조회, 변경하는 리소스입니다.

> Endpoints

```
GET /api/v2/admin/automessages/setting
PUT /api/v2/admin/automessages/setting
```

#### \[더보기 상세 내용\]

### Automessages setting property list[](#automessages-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| use\_sms | 

SMS 사용 여부

T: 사용함  
F: 사용안함

 |
| use\_kakaoalimtalk | 

카카오알림톡 사용 여부

T: 사용함  
F: 사용안함

 |
| use\_push | 

PUSH 사용 여부

T: 사용함  
F: 사용안함

 |
| send\_method | 

자동 발송 메시지 발송 방법

S: SMS  
K: 카카오알림톡(발송 실패 시  
SMS로 대체 발송)

 |
| send\_method\_push | 

푸시 수신 대상에게 푸시 우선 발송 여부

T : 우선 발송함  
F : 우선 발송 안함

 |

### Retrieve the automated message settings [](#retrieve-the-automated-message-settings)cafe24 youtube

GET /api/v2/admin/automessages/setting

###### GET

자동메시지 발송 설정내역을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve the automated message settings

*   [Retrieve the automated message settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update an automated message [](#update-an-automated-message)cafe24 youtube

PUT /api/v2/admin/automessages/setting

###### PUT

자동메시지 발송 설정내역을 변경할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **send\_method**  
**Required** | 

자동 발송 메시지 발송 방법

S: SMS  
K: 카카오알림톡(발송 실패 시  
SMS로 대체 발송)

 |
| send\_method\_push | 

푸시 수신 대상에게 푸시 우선 발송 여부

**Youtube shopping 이용 시에는 미제공**

T : 우선 발송함  
F : 우선 발송 안함

 |

Update an automated message

*   [Update an automated message](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Benefits setting

기간 할인, 재구매 할인, 대량 구매 할인, 회원 할인, 신규 상품 할인, 사은품 증정, 1+N 이벤트 등의 혜택을 등록하고 설정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/benefits/setting
PUT /api/v2/admin/benefits/setting
```

#### \[더보기 상세 내용\]

### Benefits setting property list[](#benefits-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| use\_gift | 
사은품기능 사용여부

T : 사용함  
F : 사용안함

 |
| available\_payment\_methods | 

사은품 제공 결제수단

all : 모든결제  
bank\_only : 무통장입금만  
exclude\_bank : 무통장입금 외 모든결제

 |
| allow\_point\_payment | 

적립금 전액결제 시 사은품 제공 여부

T : 제공함  
F : 제공안함

 |
| gift\_calculation\_scope | 

사은품제공 계산범위

all : 전체 주문 상품 기준  
benefit : 혜택 적용 상품만 기준

 |
| gift\_calculation\_type | 

사은품제공 계산방식

total\_order : 총 주문금액 기준  
actual\_payment : 실결제금액 기준

 |
| include\_point\_usage | 

적립금 사용금액 포함 여부

T : 포함  
F : 미포함

 |
| include\_shipping\_fee | 

배송비 포함여부

I : 포함계산  
E : 배송비 제외 계산

 |
| display\_soldout\_gifts | 

품절 사은품 표시여부

grayed : 표시하되 선택불가  
disabled : 표시하지 않음

 |
| gift\_grant\_type | 

사은품 지급형태

S : 고객 선택형  
A : 자동 지급형

 |
| gift\_selection\_mode | 

사은품 선택방식

S : 단일선택  
M : 복수선택

 |
| gift\_grant\_mode | 

사은품 지급방식

S : 단일 지급  
M : 복수 지급

 |
| gift\_selection\_step | 

사은품 선택단계

order\_form : 주문서 화면  
order\_complete : 주문완료 화면  
order\_detail : 주문상세조회 화면

 |
| gift\_available\_condition | 

사은품 신청 가능 조건

during\_period : 설정 기간 동안만 신청 가능  
after\_period : 설정 기간 이후에도 신청 가능

 |
| offer\_only\_one\_in\_automatic | 

자동 지급형 사은품 지급수량

T : 1개만 지급  
F : 상품 구매수량에 따라 지급

 |
| allow\_gift\_review | 

사은품 상품 상품후기 작성가능여부

T : 작성 가능  
F : 작성 불가

 |

### Retrieve incentive settings [](#retrieve-incentive-settings)cafe24

GET /api/v2/admin/benefits/setting

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve incentive settings

*   [Retrieve incentive settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update incentive settings [](#update-incentive-settings)cafe24

PUT /api/v2/admin/benefits/setting

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| use\_gift | 

사은품기능 사용여부

T : 사용함  
F : 사용안함

 |
| available\_payment\_methods | 

사은품 제공 결제수단

all : 모든결제  
bank\_only : 무통장입금만  
exclude\_bank : 무통장입금 외 모든결제

 |
| allow\_point\_payment | 

적립금 전액결제 시 사은품 제공 여부

T : 제공함  
F : 제공안함

 |
| gift\_calculation\_scope | 

사은품제공 계산범위

all : 전체 주문 상품 기준  
benefit : 혜택 적용 상품만 기준

 |
| gift\_calculation\_type | 

사은품제공 계산방식

total\_order : 총 주문금액 기준  
actual\_payment : 실결제금액 기준

 |
| include\_point\_usage | 

적립금 사용금액 포함 여부

T : 포함  
F : 미포함

 |
| include\_shipping\_fee | 

배송비 포함여부

I : 포함계산  
E : 배송비 제외 계산

 |
| display\_soldout\_gifts | 

품절 사은품 표시여부

grayed : 표시하되 선택불가  
disabled : 표시하지 않음

 |
| gift\_grant\_type | 

사은품 지급형태

S : 고객 선택형  
A : 자동 지급형

 |
| gift\_selection\_mode | 

사은품 선택방식

S : 단일선택  
M : 복수선택

 |
| gift\_grant\_mode | 

사은품 지급방식

S : 단일 지급  
M : 복수 지급

 |
| gift\_selection\_step | 

사은품 선택단계

order\_form : 주문서 화면  
order\_complete : 주문완료 화면  
order\_detail : 주문상세조회 화면

 |
| gift\_available\_condition | 

사은품 신청 가능 조건

사은품선택단계(gift\_selection\_step)에서 주문상세조회(order\_detail)항목이 선택된 경우만 입력 가능

during\_period : 설정 기간 동안만 신청 가능  
after\_period : 설정 기간 이후에도 신청 가능

 |
| offer\_only\_one\_in\_automatic | 

자동 지급형 사은품 지급수량

T : 1개만 지급  
F : 상품 구매수량에 따라 지급

 |
| allow\_gift\_review | 

사은품 상품 상품후기 작성가능여부

T : 작성 가능  
F : 작성 불가

 |

Update incentive settings

*   [Update incentive settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Boards setting

게시판 관리자명, 게시판 연동하기, 구매후기 작성 버튼의 노출 시점, 게시판 비밀번호 작성규칙 설정여부, 스팸 자동생성 방지 설정여부 설정 등 게시판 관련 설정의 설정 관리할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/boards/setting
PUT /api/v2/admin/boards/setting
```

#### \[더보기 상세 내용\]

### Boards setting property list[](#boards-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| admin\_name | 

게시판 관리자명

 |
| password\_rules | 

게시판 비밀번호 작성 규칙 설정 여부

 |
| linked\_board | 

게시판 연동

 |
| review\_button\_mode | 

구매 후기 작성 버튼 노출 시점

 |
| spam\_auto\_prevention | 

스팸 자동 생성 방지 설정

 |

### Retrieve board settings [](#retrieve-board-settings)cafe24

GET /api/v2/admin/boards/setting

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve board settings

*   [Retrieve board settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update board settings [](#update-board-settings)cafe24

PUT /api/v2/admin/boards/setting

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| admin\_name | 

게시판 관리자명

운영자명 : name  
운영자 닉네임 : nickname  
쇼핑몰명 : shopname  
상호명 : storename

 |
| password\_rules | 

게시판 비밀번호 작성 규칙 설정 여부

T : 사용함  
F : 사용안함

 |
| linked\_board | 

게시판 연동

사용안함 : F  
게시판 번호 : 1

 |
| review\_button\_mode | 

구매 후기 작성 버튼 노출 시점

주문상태와 상관없음 : all  
배송중 상태 : shipbegin\_date  
배송완료 후 : shipend\_date

 |
| spam\_auto\_prevention | 

스팸 자동 생성 방지 설정

 |
| 

spam\_auto\_prevention 하위 요소 보기

**type**  
스팸 자동 생성 방지 설정 방식  
S : 보안문자 입력 방식  
R : 구글 리캡챠 방식

**site\_key**  
**Required**  
구글 리캡챠 사이트 키

**secret\_key**  
**Required**  
구글 리캡챠 비밀 키







 |

Update board settings

*   [Update board settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Carts setting

장바구니 설정을 조회하고 설정을 변경할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/carts/setting
PUT /api/v2/admin/carts/setting
```

#### \[더보기 상세 내용\]

### Carts setting property list[](#carts-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| wishlist\_display | 

장바구니 관심상품 노출 여부

 |
| add\_action\_type | 

장바구니 담기 이후 액션 타입

 |
| cart\_item\_direct\_purchase | 

담긴 상품 확인 및 구매 가능여부

 |
| storage\_period | 

장바구니 저장 기간 설정 여부

 |
| period | 

설정할 저장기간

장바구니 저장기간은 1,2,3,4,5,6,7,8,9,10,14,30일 중 설정 가능

 |
| icon\_display | 

장바구니 담기 아이콘 표시 여부

 |
| cart\_item\_option\_change | 

장바구니에서 상품 옵션 변경가능 하도록 제공 여부

 |
| discount\_display | 

장바구니에 할인 금액 표시

 |

### Retrieve carts settings [](#retrieve-carts-settings)cafe24

GET /api/v2/admin/carts/setting

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve carts settings

*   [Retrieve carts settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update carts settings [](#update-carts-settings)cafe24

PUT /api/v2/admin/carts/setting

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| wishlist\_display | 

장바구니 관심상품 노출 여부

T: 사용함  
F: 사용안함

 |
| add\_action\_type | 

장바구니 담기 이후 액션 타입

M: 장바구니 페이지 바로 이동  
S: 장바구니 페이지 이동 유무 선택

 |
| cart\_item\_direct\_purchase | 

담긴 상품 확인 및 구매 가능여부

T: 사용함  
F: 사용안함

 |
| storage\_period | 

장바구니 저장 기간 설정 여부

T: 설정함  
F: 설정안함

 |
| period | 

설정할 저장기간

장바구니 저장기간은 1,2,3,4,5,6,7,8,9,10,14,30일 중 설정 가능

 |
| icon\_display | 

장바구니 담기 아이콘 표시 여부

T: 사용함  
F: 사용안함

 |
| cart\_item\_option\_change | 

장바구니에서 상품 옵션 변경가능 하도록 제공 여부

T: 사용함  
F: 사용안함

 |
| discount\_display | 

장바구니에 할인 금액 표시

T: 사용함  
F: 사용안함

 |

Update carts settings

*   [Update carts settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Categories properties setting

상품 목록 화면에 표시되는 항목의 추가 설정을 조회하고 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/categories/properties/setting
PUT /api/v2/admin/categories/properties/setting
```

#### \[더보기 상세 내용\]

### Categories properties setting property list[](#categories-properties-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| strikethrough\_retail\_price | 

소비자가 취소선 표시

 |
| strikethrough\_price | 

판매가 취소선 표시

 |
| product\_tax\_type\_text | 

판매가 부가세 표시문구

 |
| product\_discount\_price\_text | 

할인판매가 할인금액 표시문구

 |
| optimum\_discount\_price\_text | 

최적할인가 할인금액 표시문구

 |

### Retrieve additional settings for products in the list [](#retrieve-additional-settings-for-products-in-the-list)cafe24

GET /api/v2/admin/categories/properties/setting

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve additional settings for products in the list

*   [Retrieve additional settings for products in the list](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update additional settings for products in the list [](#update-additional-settings-for-products-in-the-list)cafe24

PUT /api/v2/admin/categories/properties/setting

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| strikethrough\_retail\_price | 

소비자가 취소선 표시

T : 사용함  
F : 사용안함

 |
| strikethrough\_price | 

판매가 취소선 표시

T : 사용함  
F : 사용안함

 |
| product\_tax\_type\_text | 

판매가 부가세 표시문구

 |
| 

product\_tax\_type\_text 하위 요소 보기

**use**  
사용 여부  
T : 사용함  
F : 사용안함

**color**  
글자 색상

**font\_size**  
글자 크기

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)







 |
| product\_discount\_price\_text | 

할인판매가 할인금액 표시문구

 |
| 

product\_discount\_price\_text 하위 요소 보기

**use**  
사용 여부  
T : 사용함  
F : 사용안함

**color**  
글자 색상

**font\_size**  
글자 크기

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)







 |
| optimum\_discount\_price\_text | 

최적할인가 할인금액 표시문구

 |
| 

optimum\_discount\_price\_text 하위 요소 보기

**use**  
사용 여부  
T : 사용함  
F : 사용안함

**color**  
글자 색상

**font\_size**  
글자 크기

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)







 |

Update additional settings for products in the list

*   [Update additional settings for products in the list](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Coupons setting

쿠폰 설정(Coupons setting)은 쇼핑몰에서 사용할 쿠폰의 기본적인 설정을 입력할 수 있습니다.  
쿠폰의 할인, 적립 기능의 사용여부와 제한조건, 진열 등 다양한 측면의 설정이 가능합니다.

> Endpoints

```
GET /api/v2/admin/coupons/setting
PUT /api/v2/admin/coupons/setting
```

#### \[더보기 상세 내용\]

### Coupons setting property list[](#coupons-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| use\_coupon | 

쿠폰사용

T:사용함  
F:사용안함

 |
| available\_issue\_type | 

쿠폰 사용 제한

A:주문서+상품별 쿠폰 사용  
O:주문서 쿠폰만 사용  
P:상품별 쿠폰만 사용

 |
| allow\_using\_coupons\_with\_points | 

적립금 동시사용

T:사용함  
F:사용안함

 |
| allow\_using\_coupons\_with\_discounts | 

할인 동시사용

A:쿠폰+회원등급 할인 동시 사용  
C:쿠폰만 사용  
G:회원등급 할인만 사용

 |
| allow\_using\_product\_and\_order\_coupons | 

상품/주문서 동시사용

T:사용함  
F:사용안함

 |
| recover\_coupon\_setting | 

쿠폰 복원 설정

 |
| max\_coupon\_count | 

쿠폰 사용 개수 제한

 |
| use\_additional\_coupon | 

추가 사용 쿠폰

T:사용함  
F:사용안함

 |
| additional\_coupon\_no | 

추가 사용 쿠폰 번호

 |
| expiration\_notice\_date\_setting | 

쿠폰 만료일 안내 발송 기준 설정

 |
| show\_coupon\_to\_non\_members | 

비회원 노출설정

T:노출함  
F:노출안함

 |
| show\_group\_coupon\_to\_non\_members | 

회원등급할인이 지정된 쿠폰 포함

T : 포함  
F : 미포함

 |
| show\_issued\_coupon | 

발급된 쿠폰 표시 여부

T:노출함  
F:노출안함

 |
| sorting\_type | 

정렬 기준

A:쿠폰 시작일자  
B:쿠폰 종료일자  
C:쿠폰 발급일자  
D:할인/적립금액  
E:할인/적립율

 |
| download\_image\_type | 

기본 쿠폰 다운로드 이미지

1:TYPE1  
2:TYPE2  
3:TYPE3  
4:TYPE4  
5:TYPE5

 |
| background\_image\_type | 

기본 쿠폰 배경 이미지

1:TYPE1  
2:TYPE2  
3:TYPE3  
4:TYPE4  
5:TYPE5

 |

### Retrieve coupon settings [](#retrieve-coupon-settings)cafe24

GET /api/v2/admin/coupons/setting

###### GET

쿠폰 사용 여부나 쿠폰과 할인 동시 사용 여부 등 설정 정보를 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve coupon settings

*   [Retrieve coupon settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update coupon settings [](#update-coupon-settings)cafe24

PUT /api/v2/admin/coupons/setting

###### PUT

쿠폰 설정 정보를 수정합니다.  
쿠폰 사용여부, 쿠폰 사용 제한, 쿠폰 사용 개수 제한 등의 정보를 변경할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| use\_coupon | 

쿠폰사용

T:사용함  
F:사용안함

 |
| available\_issue\_type | 

쿠폰 사용 제한

A:주문서+상품별 쿠폰 사용  
O:주문서 쿠폰만 사용  
P:상품별 쿠폰만 사용

 |
| allow\_using\_coupons\_with\_points | 

적립금 동시사용

T:사용함  
F:사용안함

 |
| allow\_using\_coupons\_with\_discounts | 

할인 동시사용

A:쿠폰+회원등급 할인 동시 사용  
C:쿠폰만 사용  
G:회원등급 할인만 사용

 |
| allow\_using\_product\_and\_order\_coupons | 

상품/주문서 동시사용

T:사용함  
F:사용안함

 |
| recover\_coupon\_setting | 

쿠폰 복원 설정

 |
| 

recover\_coupon\_setting 하위 요소 보기

**restore\_viewpoint**  
쿠폰 복원 시점  
A: 취소/교환/반품 접수  
B: 취소/교환/반품 완료

**cancel\_before\_pay**  
입금전취소  
T:자동 복원함  
F:자동 복원 안함  
M:쿠폰복원 여부를 확인함

**cancel\_after\_pay**  
입금후 취소  
T:자동 복원함  
F:자동 복원 안함  
M:쿠폰복원 여부를 확인함

**return**  
반품  
T:자동 복원함  
F:자동 복원 안함  
M:쿠폰복원 여부를 확인함

**exchange**  
교환  
T:자동 복원함  
F:자동 복원 안함  
M:쿠폰복원 여부를 확인함

**part**  
부분 취소/반품/교환  
F:쿠폰 복원 안함  
M:쿠폰복원 여부를 확인함







 |
| max\_coupon\_count | 

쿠폰 사용 개수 제한

 |
| 

max\_coupon\_count 하위 요소 보기

**product\_per\_product**  
상품당 상품쿠폰 사용 개수 제한

**order\_per\_order**  
주문당 주문서 쿠폰 개수 제한

**product\_and\_order\_per\_order**  
주문당 쿠폰 사용 개수 제한

**product\_per\_order**  
주문당 상품쿠폰 쿠폰 개수 제한

**product\_and\_order\_per\_day**  
일일 쿠폰 사용 개수 제한

**product\_per\_item**  
품목당 상품쿠폰 사용 개수 제한







 |
| use\_additional\_coupon | 

추가 사용 쿠폰

T:사용함  
F:사용안함

 |
| additional\_coupon\_no  

_배열 최대사이즈: \[5\]_

 | 

추가 사용 쿠폰 번호

 |
| 

additional\_coupon\_no 하위 요소 보기

**coupon\_no**  
쿠폰번호







 |
| expiration\_notice\_date\_setting | 

쿠폰 만료일 안내 발송 기준 설정

 |
| 

expiration\_notice\_date\_setting 하위 요소 보기

**expiration\_notice\_date\_type**  
발송 기준 설정  
발송기간 기준 설정:C  
발송기간 전체 설정:A

**expiration\_notice\_date**  
발송기간 기준 설정 만료일  
1일 전:one\_day  
3일 전:three\_day  
7일 전:seven\_day







 |
| show\_coupon\_to\_non\_members | 

비회원 노출설정

T:노출함  
F:노출안함

 |
| show\_group\_coupon\_to\_non\_members | 

회원등급할인이 지정된 쿠폰 포함

T : 포함  
F : 미포함

 |
| show\_issued\_coupon | 

발급된 쿠폰 표시 여부

T:노출함  
F:노출안함

 |
| sorting\_type | 

정렬 기준

A:쿠폰 시작일자  
B:쿠폰 종료일자  
C:쿠폰 발급일자  
D:할인/적립금액  
E:할인/적립율

 |
| download\_image\_type | 

기본 쿠폰 다운로드 이미지

1:TYPE1  
2:TYPE2  
3:TYPE3  
4:TYPE4  
5:TYPE5

 |
| background\_image\_type | 

기본 쿠폰 배경 이미지

1:TYPE1  
2:TYPE2  
3:TYPE3  
4:TYPE4  
5:TYPE5

 |

Update coupon settings

*   [Update coupon settings](#none)
*   [Disable using coupon in the store](#none)
*   [Update max count of using coupons by product](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Currency

환율 정보(Currency)는 쇼핑몰의 화폐 정보, 환율 정보 등을 확인할 수 있는 리소스입니다.

> Endpoints

```
GET /api/v2/admin/currency
PUT /api/v2/admin/currency
```

#### \[더보기 상세 내용\]

### Currency property list[](#currency-property-list)

| **Attribute** | **Description** |
| --- | --- |
| exchange\_rate | 
결제 화폐 환율 정보

 |
| standard\_currency\_code | 

기준 화폐 코드

해당 쇼핑몰의 기본쇼핑몰에서 사용하는 화폐 코드. 기준 화폐란 일반적으로 쇼핑몰 운영자가 속한 국가에서 통용되는 화폐를 의미한다.

 |
| standard\_currency\_symbol | 

기준 화폐 심볼

해당 쇼핑몰의 기본쇼핑몰에서 사용하는 화폐의 화폐 기호. 기준 화폐란 일반적으로 쇼핑몰 운영자가 속한 국가에서 통용되는 화폐를 의미한다.

 |
| shop\_currency\_code | 

결제 화폐 코드

 |
| shop\_currency\_symbol | 

결제 화폐 심볼

 |
| shop\_currency\_format | 

결제 화폐 표시 방식

 |

### Retrieve currency settings [](#retrieve-currency-settings)cafe24

GET /api/v2/admin/currency

###### GET

쇼핑몰에서 사용하는 화폐의 정보와 환율 정보를 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

Retrieve currency settings

*   [Retrieve currency settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a currency [](#update-a-currency)cafe24

PUT /api/v2/admin/currency

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **shop\_no**  
**Required**  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **exchange\_rate**  
**Required** | 

결제 화폐 환율 정보

 |

Update a currency

*   [Update a currency](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Customers setting

회원관련 설정 시 회원가입항목을 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/customers/setting
PUT /api/v2/admin/customers/setting
```

#### \[더보기 상세 내용\]

### Customers setting property list[](#customers-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| simple\_member\_join | 

회원가입항목 표시

T:기본항목 표시  
F:상세항목 표시

 |
| member\_authentication | 

회원 가입인증

T:사용함  
F:사용안함

 |
| minimum\_age\_restriction | 

14세미만 가입제한

M:인증 후 이용  
T:인증없이 바로 이용  
F:가입 불가

 |
| adult\_age\_restriction | 

19세미만 가입제한

T:사용함  
F:사용안함

 |
| adult\_purchase\_restriction | 

성인인증 사용 시 구매차단 설정

T:사용함  
F:사용안함

 |
| adult\_image\_restriction | 

성인인증 사용 시 19금 이미지 노출 설정

T:사용함  
F:사용안함

 |
| gender\_restriction | 

성별 가입제한

B:사용안함  
M:남성만  
F:여성만

 |
| member\_rejoin\_restriction | 

회원 재가입제한

T:사용함  
F:사용안함

 |
| member\_rejoin\_restriction\_day | 

회원 재가입제한 기간

 |
| password\_authentication | 

회원정보수정 페이지 접속 시 비밀번호 인증

T:사용함  
F:사용안함

 |
| member\_join\_confirmation | 

회원가입 입력 정보 확인

T:사용함  
F:사용안함

 |
| email\_duplication | 

이메일 중복 체크

T:사용함  
F:사용안함

 |
| password\_recovery | 

비밀번호 찾기 방법 설정

T:임시 비밀번호 전송  
N:비밀번호 즉시변경

 |
| link\_social\_account | 

회원가입 시 SNS 계정 연동

T:SNS 가입 시 동일한 이메일을 가진 계정이 있으면 연동 화면을 제공  
F:연동 화면을 제공하지 않음

 |
| save\_member\_id | 

아이디저장

T:사용함  
F:사용안함

 |
| unregistration\_admin\_approval | 

탈퇴회원 관리자 승인

T:사용함  
F:사용안함

 |
| unregistration\_reason | 

탈퇴사유

T:사용함  
F:사용안함

 |
| display\_group | 

회원등급 표시

T:사용  
F:사용안함

 |
| join\_standard | 

가입기준

id:아이디  
email:이메일

 |
| use\_update\_birthday | 

생년월일 수정

T:허용함  
F:허용안함

 |

### Retrieve member-related settings [](#retrieve-member-related-settings)cafe24

GET /api/v2/admin/customers/setting

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve member-related settings

*   [Retrieve member-related settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update customers setting [](#update-customers-setting)cafe24

PUT /api/v2/admin/customers/setting

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| simple\_member\_join | 

회원가입항목 표시

"F"(상세항목 표시)에서 "T"(기본항목 표시)로 변경할 경우, 아래 기능은 자동으로 사용 불가 상태로 변경됨.  
  
\- 회원 가입인증  
\- 14세 미만 가입제한  
\- 19세 미만 가입제한  
\- 성별 가입제한  
\- 회원가입 입력 정보 확인  
\- 본인인증 서비스 설정  
\- 비밀번호 확인시 질문/답변

T:기본항목 표시  
F:상세항목 표시

 |
| member\_authentication | 

회원 가입인증

T:사용함  
F:사용안함

 |
| minimum\_age\_restriction | 

14세미만 가입제한

M:인증 후 이용  
T:인증없이 바로 이용  
F:가입 불가

 |
| join\_standard | 

가입기준

id:아이디  
email:이메일

 |
| use\_update\_birthday | 

생년월일 수정

T:허용함  
F:허용안함

 |

Update customers setting

*   [Update customers setting](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Dashboard

대시보드(Dashboard)는 쇼핑몰의 주문 현황과 매출 현황 등 쇼핑몰 운영에 필요한 정보를 간략하게 요약해놓은 정보입니다.

> Endpoints

```
GET /api/v2/admin/dashboard
```

#### \[더보기 상세 내용\]

### Dashboard property list[](#dashboard-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| daily\_sales\_stats | 

일일 현황 정보

일 단위의 매출 현황 정보

 |
| weekly\_sales\_stats | 

주간 매출 현황

주간 단위의 매출 현황 정보

 |
| monthly\_sales\_stats | 

월간 매출 현황

월간 단위의 매출 현황 정보

 |
| sold\_out\_products\_count | 

품절된 상품 수

품절된 상품의 수. 재고관리기능과 품절기능이 활성화 되어있을 경우 집계에 포함됨.

 |
| new\_members\_count | 

신규회원 수

신규가입한 회원의 숫자

 |
| board\_list | 

게시판 목록

해당 몰의 게시판의 리스트

 |

### Retrieve a dashboard [](#retrieve-a-dashboard)cafe24

GET /api/v2/admin/dashboard

###### GET

대시보드 정보를 조회합니다.  
매출 현황 정보등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |

Retrieve a dashboard

*   [Retrieve a dashboard](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Dormantaccount

휴면 회원 기능을 설정하고 조회할 수 있습니다. 휴면회원 기능은 기본몰에서만 호출 가능합니다.

> Endpoints

```
GET /api/v2/admin/dormantaccount
PUT /api/v2/admin/dormantaccount
```

#### \[더보기 상세 내용\]

### Dormantaccount property list[](#dormantaccount-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| use | 

휴면회원 기능 사용여부

T:사용함  
F:사용안함

 |
| notice\_send\_automatic | 

휴면안내 자동 발송 사용여부

T:사용함  
F:사용안함

 |
| send\_sms | 

휴면안내 발송 수단 SMS/카카오알림톡 사용여부

T:사용함  
F:사용안함

 |
| send\_email | 

휴면안내 발송 수단 대량메일 사용여부

T:사용함  
F:사용안함

 |
| point\_extinction | 

휴면회원 적립금 소멸 여부

T:소멸함  
F:소멸안함

 |

### Retrieve account deactivation settings [](#retrieve-account-deactivation-settings)cafe24

GET /api/v2/admin/dormantaccount

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve account deactivation settings

*   [Retrieve account deactivation settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update account deactivation settings [](#update-account-deactivation-settings)cafe24

PUT /api/v2/admin/dormantaccount

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| use | 

휴면회원 기능 사용여부

T:사용함  
F:사용안함

 |
| notice\_send\_automatic | 

휴면안내 자동 발송 사용여부

T:사용함  
F:사용안함

 |
| send\_sms | 

휴면안내 발송 수단 SMS/카카오알림톡 사용여부

T:사용함  
F:사용안함

 |
| send\_email | 

휴면안내 발송 수단 대량메일 사용여부

T:사용함  
F:사용안함

 |
| point\_extinction | 

휴면회원 적립금 소멸 여부

T:소멸함  
F:소멸안함

 |

Update account deactivation settings

*   [Update account deactivation settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Financials paymentgateway

Financials paymentgateway(PG 정보)는 PG사별 계약정보를 제공합니다.

> Endpoints

```
GET /api/v2/admin/financials/paymentgateway
```

#### \[더보기 상세 내용\]

### Financials paymentgateway property list[](#financials-paymentgateway-property-list)

| **Attribute** | **Description** |
| --- | --- |
| partner\_id | 
PG사 발급 가맹점 ID

 |
| payment\_gateway\_name | 

PG 이름

inicis : 이니시스  
kcp : KCP  
allat : 올앳  
ksnet : KSNET  
dacom : 토스페이먼츠  
allthegate : 올더게이트  
settlebank : 세틀뱅크  
smartro : 스마트로  
kicc : 한국정보통신  
mobilians : 모빌리언스  
danal : 다날

 |
| contract\_date | 

PG 계약일

 |
| setting\_date | 

PG 세팅일

 |
| bank\_code | 

정산입금 은행코드

[은행 코드 조회하기](https://www.kftc.or.kr/kftc/data/EgovBankList.do) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/shortcut_icon.png)

 |
| bank\_account\_no | 

정산입금 계좌정보

 |
| status | 

금융제휴여부

T:제휴함  
F: 제휴안함

 |
| bank\_account\_name | 

정산입금 예금주명

 |
| payment\_method\_information | 

결제수단별 정산 정보

※ payment\_method\_information 하위 요소에 대한 값 정의  
  
1) payment\_method\_information > period(정산 기간)  
  
D : 일별  
W : 주별  
M : 월별

 |

### Retrieve a list of Payment Gateway contract details [](#retrieve-a-list-of-payment-gateway-contract-details)cafe24

GET /api/v2/admin/financials/paymentgateway

###### GET

PG사별 계약정보를 목록으로 조회할 수 있습니다.  
PG계약일, 결제수단별 정산 정보 등을 확인할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| payment\_gateway\_name | 
PG 이름

 |
| partner\_id | 

PG사 발급 가맹점 ID

 |

Retrieve a list of Payment Gateway contract details

*   [Retrieve a list of Payment Gateway contract details](#none)
*   [Retrieve paymentgateway with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Financials store

Financials store(상점의 거래정보)는 상점의 PG사별 거래정보를 제공합니다.

> Endpoints

```
GET /api/v2/admin/financials/store
```

#### \[더보기 상세 내용\]

### Financials store property list[](#financials-store-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| first\_payment\_date | 

최초 결제일

 |
| payment\_gateway\_name | 

PG 이름

 |

### Retrieve the transaction information of a store [](#retrieve-the-transaction-information-of-a-store)cafe24

GET /api/v2/admin/financials/store

###### GET

상점의 결제수단별 거래정보를 조회할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **payment\_method**  
**Required** | 

결제수단 코드

card : 신용카드  
tcash : 계좌이체  
icash : 가상계좌  
cell : 휴대폰  
deferpay : 후불  
cvs : 편의점  
point : 선불금  
etc : 기타

 |

Retrieve the transaction information of a store

*   [Retrieve the transaction information of a store](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Images setting

상품 이미지 사이즈 설정 값을 조회하거나 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/images/setting
PUT /api/v2/admin/images/setting
```

#### \[더보기 상세 내용\]

### Images setting property list[](#images-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| product\_image\_size | 

상품 이미지 사이즈 설정값

 |

### Retrieve product image size settings [](#retrieve-product-image-size-settings)cafe24

GET /api/v2/admin/images/setting

###### GET

상품 이미지 사이즈 설정 값을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve product image size settings

*   [Retrieve product image size settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update product image size settings [](#update-product-image-size-settings)cafe24

PUT /api/v2/admin/images/setting

###### PUT

상품 이미지 사이즈 설정 값을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_image\_size**  
**Required** | 

상품 이미지 사이즈 설정값

 |
| 

product\_image\_size 하위 요소 보기

**detail\_image\_width**  
상세 이미지 가로

**detail\_image\_height**  
상세이미지 세로

**list\_image\_width**  
목록 이미지 가로

**list\_image\_height**  
목록 이미지 세로

**tiny\_image\_width**  
작은 목록 이미지 가로

**tiny\_image\_height**  
작은 목록 이미지 세로

**zoom\_image\_width**  
확대 이미지 가로

**zoom\_image\_height**  
확대 이미지 세로

**small\_image\_width**  
축소 이미지 가로

**small\_image\_height**  
축소 이미지 세로







 |

Update product image size settings

*   [Update product image size settings](#none)
*   [Try to change image setting without using required field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Information

쇼핑몰의 기타이용 안내사항을 설정할 수 있습니다

> Endpoints

```
GET /api/v2/admin/information
PUT /api/v2/admin/information
```

#### \[더보기 상세 내용\]

### Information property list[](#information-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| type | 

안내 유형

[information\_type](https://appservice-guide.s3.ap-northeast-2.amazonaws.com/resource/ko/information_type.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| display\_mobile | 

모바일 표시 여부

T : 표시함  
F : 표시안함

 |
| use | 

사용 여부

T: 사용함  
F: 사용안함

 |
| content | 

안내 내용

 |

### Retrieve store policies [](#retrieve-store-policies)cafe24

GET /api/v2/admin/information

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve store policies

*   [Retrieve store policies](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update store policies [](#update-store-policies)cafe24

PUT /api/v2/admin/information

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **8** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **type**  
**Required** | 

안내 유형

[information\_type](https://appservice-guide.s3.ap-northeast-2.amazonaws.com/resource/ko/information_type.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| display\_mobile | 

모바일 표시 여부

T : 표시함  
F : 표시안함

 |
| use | 

사용 여부

T: 사용함  
F: 사용안함

 |
| save\_type | 

저장 방식

S: 표준 안내 적용  
C: 사용자 정의 안내 적용

 |
| content | 

안내 내용

 |

Update store policies

*   [Update store policies](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Kakaoalimtalk profile

상점의 카카오채널 프로필키 등록여부를 확인할 수 있는 리소스입니다.

> Endpoints

```
GET /api/v2/admin/kakaoalimtalk/profile
```

#### \[더보기 상세 내용\]

### Kakaoalimtalk profile property list[](#kakaoalimtalk-profile-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| kakao\_senderkey | 

카카오 채널 발신 프로필 키

 |

### Retrieve a Kakao Channel sender profile key [](#retrieve-a-kakao-channel-sender-profile-key)cafe24

GET /api/v2/admin/kakaoalimtalk/profile

###### GET

카카오채널 발신 프로필키(senderkey)를 조회할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve a Kakao Channel sender profile key

*   [Retrieve a Kakao Channel sender profile key](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Kakaoalimtalk setting

카카오알림톡 서비스(Kakaoalimtalk setting) 사용 여부를 조회하고 설정을 변경하는 리소스입니다.

> Endpoints

```
GET /api/v2/admin/kakaoalimtalk/setting
PUT /api/v2/admin/kakaoalimtalk/setting
```

#### \[더보기 상세 내용\]

### Kakaoalimtalk setting property list[](#kakaoalimtalk-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| use\_kakaoalimtalk | 

카카오알림톡 사용 여부

T: 사용함  
F: 사용안함

 |

### Retrieve the Kakao Info-talk settings [](#retrieve-the-kakao-info-talk-settings)cafe24

GET /api/v2/admin/kakaoalimtalk/setting

###### GET

카카오알림톡 서비스 발송설정 내역을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve the Kakao Info-talk settings

*   [Retrieve the Kakao Info-talk settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update the Kakao Info-talk settings [](#update-the-kakao-info-talk-settings)cafe24

PUT /api/v2/admin/kakaoalimtalk/setting

###### PUT

카카오알림톡 서비스 발송 설정내역을 변경할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| use\_kakaoalimtalk | 

카카오알림톡 사용 여부

T: 사용함  
F: 사용안함

 |

Update the Kakao Info-talk settings

*   [Update the Kakao Info-talk settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Kakaopay setting

쇼핑몰의 카카오페이 설정을 조회하거나 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/kakaopay/setting
PUT /api/v2/admin/kakaopay/setting
```

#### \[더보기 상세 내용\]

### Kakaopay setting property list[](#kakaopay-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| shop\_key | 

입점시 부여 받는 판매점의 고유 식별자

 |
| pixel\_code | 

연동사(ECP/독립몰)에서 이미 사용중인 카카오 광고 픽셀 ID

 |
| use\_kakaopay | 

카카오페이 구매 사용여부

T : 사용함  
F : 사용안함

 |
| product\_detail\_button\_size | 

쇼핑몰 상세상품 페이지 버튼 사이즈

 |
| basket\_button\_size | 

쇼핑몰 장바구니 페이지 버튼 사이즈

 |
| use\_dark\_mode | 

쇼핑몰 다크모드 적용여부

T : 활성화  
F : 비활성화

 |
| button\_authorization\_key | 

입점시 부여 받는 판매점의 버튼 인증

 |
| thirdparty\_agree | 

제3자 제공 동의 여부

T : 동의함  
F : 동의안함

 |
| thirdparty\_agree\_date | 

제3자 제공 동의 날짜

 |

### Retrieve settings for KakaoPay orders [](#retrieve-settings-for-kakaopay-orders)cafe24

GET /api/v2/admin/kakaopay/setting

###### GET

쇼핑몰의 카카오페이 설정을 조회합니다.  
카카오페이 구매 사용여부, 제3자 제공 동의 여부 등의 정보를 확인할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve settings for KakaoPay orders

*   [Retrieve settings for KakaoPay orders](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update settings for KakaoPay orders [](#update-settings-for-kakaopay-orders)cafe24

PUT /api/v2/admin/kakaopay/setting

###### PUT

쇼핑몰의 카카오페이 설정을 수정합니다.  
카카오페이 구매 사용여부, 쇼핑몰 다크모드 적용여부 등의 정보를 수정할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| shop\_key | 

입점시 부여 받는 판매점의 고유 식별자

 |
| pixel\_code | 

연동사(ECP/독립몰)에서 이미 사용중인 카카오 광고 픽셀 ID

 |
| use\_kakaopay | 

카카오페이 구매 사용여부

T : 사용함  
F : 사용안함

 |
| product\_detail\_button\_size | 

쇼핑몰 상세상품 페이지 버튼 사이즈

 |
| 

product\_detail\_button\_size 하위 요소 보기

**pc**  
pc

**mobile**  
mobile







 |
| basket\_button\_size | 

쇼핑몰 장바구니 페이지 버튼 사이즈

 |
| 

basket\_button\_size 하위 요소 보기

**pc**  
pc

**mobile**  
mobile







 |
| use\_dark\_mode | 

쇼핑몰 다크모드 적용여부

T : 활성화  
F : 비활성화

 |
| button\_authorization\_key | 

입점시 부여 받는 판매점의 버튼 인증

 |
| thirdparty\_agree | 

제3자 제공 동의 여부

T : 동의함  
F : 동의안함

 |
| thirdparty\_agree\_date  

_날짜_

 | 

제3자 제공 동의 날짜

 |

Update settings for KakaoPay orders

*   [Update settings for KakaoPay orders](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Mains properties setting

메인 화면에 표시되는 항목의 추가 설정을 조회하고 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/mains/properties/setting
PUT /api/v2/admin/mains/properties/setting
```

#### \[더보기 상세 내용\]

### Mains properties setting property list[](#mains-properties-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| strikethrough\_retail\_price | 

소비자가 취소선 표시

 |
| strikethrough\_price | 

판매가 취소선 표시

 |
| product\_tax\_type\_text | 

판매가 부가세 표시문구

 |
| product\_discount\_price\_text | 

할인판매가 할인금액 표시문구

 |
| optimum\_discount\_price\_text | 

최적할인가 할인금액 표시문구

 |

### Retrieve additional settings for products on the main screen [](#retrieve-additional-settings-for-products-on-the-main-screen)cafe24

GET /api/v2/admin/mains/properties/setting

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve additional settings for products on the main screen

*   [Retrieve additional settings for products on the main screen](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update additional settings for products on the main screen [](#update-additional-settings-for-products-on-the-main-screen)cafe24

PUT /api/v2/admin/mains/properties/setting

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| strikethrough\_retail\_price | 

소비자가 취소선 표시

T : 사용함  
F : 사용안함

 |
| strikethrough\_price | 

판매가 취소선 표시

T : 사용함  
F : 사용안함

 |
| product\_tax\_type\_text | 

판매가 부가세 표시문구

 |
| 

product\_tax\_type\_text 하위 요소 보기

**use**  
사용 여부  
T : 사용함  
F : 사용안함

**color**  
글자 색상

**font\_size**  
글자 크기

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)







 |
| product\_discount\_price\_text | 

할인판매가 할인금액 표시문구

 |
| 

product\_discount\_price\_text 하위 요소 보기

**use**  
사용 여부  
T : 사용함  
F : 사용안함

**color**  
글자 색상

**font\_size**  
글자 크기

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)







 |
| optimum\_discount\_price\_text | 

최적할인가 할인금액 표시문구

 |
| 

optimum\_discount\_price\_text 하위 요소 보기

**use**  
사용 여부  
T : 사용함  
F : 사용안함

**color**  
글자 색상

**font\_size**  
글자 크기

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)







 |

Update additional settings for products on the main screen

*   [Update additional settings for products on the main screen](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Menus

메뉴(Menus)는 쇼핑몰의 메뉴 모드에 관한 기능입니다.  
쇼핑몰의 메뉴 모드와 경로 등을 조회할 수 있습니다.  
쇼핑몰의 메뉴 모드로는 프로모드, 스마트모드, 모바일 어드민이 있습니다.

> Endpoints

```
GET /api/v2/admin/menus
```

#### \[더보기 상세 내용\]

### Menus property list[](#menus-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| mode | 

메뉴 모드

new\_pro: PC 어드민  
mobile\_admin : 모바일 어드민

 |
| menu\_no | 

메뉴 번호

 |
| name | 

메뉴명

 |
| path | 

메뉴 경로

 |
| contains\_app\_url | 

앱 URL 포함 여부

T : 포함  
F : 미포함

 |

### Retrieve menus [](#retrieve-menus)cafe24

GET /api/v2/admin/menus

###### GET

쇼핑몰의 메뉴 모드와 경로 등을 목록으로 조회할 수 있습니다.  
메뉴 모드, 메뉴 번호, 앱 URL 포함 여부 등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| mode | 

메뉴 모드

new\_pro: PC 어드민  
mobile\_admin : 모바일 어드민

DEFAULT new\_pro

 |
| menu\_no | 

메뉴 번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| contains\_app\_url | 

앱 URL 포함 여부

T : 포함  
F : 미포함

 |

Retrieve menus

*   [Retrieve menus](#none)
*   [Retrieve menus with fields parameter](#none)
*   [Retrieve a specific menus with menu\_no parameter](#none)
*   [Retrieve multiple menus](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Mobile setting

모바일 설정(Mobile setting)은 쇼핑몰의 모바일 쇼핑몰 설정에 관한 리소스입니다.  
모바일 쇼핑몰 사용 여부와 접속 주소 자동연결의 사용/사용안함 여부를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/mobile/setting
PUT /api/v2/admin/mobile/setting
```

#### \[더보기 상세 내용\]

### Mobile setting property list[](#mobile-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| use\_mobile\_page | 

모바일 쇼핑몰 사용설정

T : 사용함  
F : 사용안함

 |
| use\_mobile\_domain\_redirection | 

모바일 접속 주소 자동연결 설정

T : 사용함  
F : 사용안함

 |

### Retrieve mobile settings [](#retrieve-mobile-settings)cafe24

GET /api/v2/admin/mobile/setting

###### GET

쇼핑몰의 모바일 설정을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve mobile settings

*   [Retrieve mobile settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update mobile settings [](#update-mobile-settings)cafe24

PUT /api/v2/admin/mobile/setting

###### PUT

쇼핑몰의 모바일 설정을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| use\_mobile\_page | 

모바일 쇼핑몰 사용설정

T : 사용함  
F : 사용안함

 |

Update mobile settings

*   [Update mobile settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Naverpay setting

네이버페이 설정(Naverpay Setting)은 쇼핑몰의 네이버페이 공통인증키를 조회하거나 수정할 수 있는 기능입니다.

> Endpoints

```
GET /api/v2/admin/naverpay/setting
POST /api/v2/admin/naverpay/setting
PUT /api/v2/admin/naverpay/setting
```

#### \[더보기 상세 내용\]

### Naverpay setting property list[](#naverpay-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| authentication\_key | 

네이버 공통 인증키

 |
| naverpay\_version | 

네이버페이 연동버전

 |
| shop\_id | 

페이센터 ID

 |
| is\_button\_show | 

네이버페이 구매 버튼 노출

 |
| is\_used\_order | 

네이버 주문연동

 |
| is\_used\_review | 

네이버 구매평연동

 |
| is\_show\_review | 

네이버 구매평노출

 |
| is\_order\_page | 

네이버페이 구매 버튼 클릭 시 페이지 이동

 |
| certi\_key | 

네이버 가맹점 인증키

 |
| image\_key | 

네이버 버튼 인증키

 |
| naver\_button\_pc\_product | 

네이버 버튼 디자인 : PC 상품상세페이지

 |
| naver\_button\_pc\_basket | 

네이버 버튼 디자인 : PC 장바구니페이지

 |
| naver\_button\_mobile\_product | 

네이버 버튼 디자인 : Mobile 상품상세페이지

 |
| naver\_button\_mobile\_basket | 

네이버 버튼 디자인 : Mobile 장바구니페이지

 |

### Retrieve Naver Pay settings [](#retrieve-naver-pay-settings)cafe24

GET /api/v2/admin/naverpay/setting

###### GET

쇼핑몰의 네이버페이 공통인증키를 조회합니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve Naver Pay settings

*   [Retrieve Naver Pay settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create Naver Pay settings [](#create-naver-pay-settings)cafe24

POST /api/v2/admin/naverpay/setting

###### POST

네이버페이 가맹 시 네이버에서 발급한 공통인증키를 쇼핑몰 어드민에 등록할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| authentication\_key  

_형식 : \[a-zA-Z0-9\_-\]_  
_최대글자수 : \[50자\]_

 | 

네이버 공통 인증키

 |
| naverpay\_version | 

네이버페이 연동버전

DEFAULT 2.1

 |
| **shop\_id**  
**Required** | 

페이센터 ID

 |
| is\_button\_show | 

네이버페이 구매 버튼 노출

DEFAULT T

 |
| is\_used\_order | 

네이버 주문연동

DEFAULT T

 |
| is\_used\_review | 

네이버 구매평연동

DEFAULT T

 |
| is\_show\_review | 

네이버 구매평노출

DEFAULT T

 |
| is\_order\_page | 

네이버페이 구매 버튼 클릭 시 페이지 이동

DEFAULT N

 |
| **certi\_key**  
**Required** | 

네이버 가맹점 인증키

 |
| **image\_key**  
**Required** | 

네이버 버튼 인증키

 |
| naver\_button\_pc\_product | 

네이버 버튼 디자인 : PC 상품상세페이지

DEFAULT A|1|2

 |
| naver\_button\_pc\_basket | 

네이버 버튼 디자인 : PC 장바구니페이지

DEFAULT A|1|1

 |
| naver\_button\_mobile\_product | 

네이버 버튼 디자인 : Mobile 상품상세페이지

DEFAULT MA|1|2

 |
| naver\_button\_mobile\_basket | 

네이버 버튼 디자인 : Mobile 장바구니페이지

DEFAULT MA|1|1

 |

Create Naver Pay settings

*   [Create Naver Pay settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update Naver Pay settings [](#update-naver-pay-settings)cafe24

PUT /api/v2/admin/naverpay/setting

###### PUT

쇼핑몰의 네이버페이 공통인증키를 수정합니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| authentication\_key  

_형식 : \[a-zA-Z0-9\_-\]_  
_최대글자수 : \[50자\]_

 | 

네이버 공통 인증키

 |

Update Naver Pay settings

*   [Update Naver Pay settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orderform setting

주문서 입력항목을 설정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orderform/setting
PUT /api/v2/admin/orderform/setting
```

#### \[더보기 상세 내용\]

### Orderform setting property list[](#orderform-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| buy\_limit\_type | 

구매 제한

M:회원만 구매  
A:모두 구매 가능

 |
| guest\_purchase\_button\_display | 

비회원 구매버튼 노출

buy\_limit\_type를 M(회원만 구매)으로 선택 하였을때만 설정 가능

T : 사용함  
F : 사용안함

 |
| junior\_purchase\_block | 

14세 미만 구매 차단

buy\_limit\_type를 A(모두 구매 가능)으로 선택하였을때만 설정 가능

T : 사용함  
F : 사용안함

 |
| reservation\_order | 

예약주문

T : 사용함  
F : 사용안함

 |
| discount\_amount\_display | 

주문상품 할인금액 표시

T : 사용함  
F : 사용안함

 |
| order\_item\_delete | 

주문서 내 상품삭제

T : 사용함  
F : 사용안함

 |
| quick\_signup | 

주문서 간단회원가입

T : 사용함  
F : 사용안함

 |
| check\_order\_info | 

주문서 입력정보 확인

T : 사용함  
F : 사용안함

 |
| order\_form\_input\_type | 

주문서 입력정보 구성

A : 배송정보만 입력  
S : 주문/배송정보 개별입력

 |
| shipping\_info | 

주문서 입력정보 상세설정 > 배송 정보

 |
| order\_info | 

주문서 입력정보 상세설정 > 주문 정보

order\_form\_input\_type이 A일때 order\_info 입력 불가

 |
| china\_taiwan\_id\_input | 

중국/대만 신분증 ID 입력

T : 사용함  
F : 사용안함

 |
| print\_type | 

인쇄버튼 타입

 |
| orderform\_additional\_enabled | 

주문서 추가항목 사용여부

T : 사용  
F : 사용안함

 |

### Retrieve the order/order form settings [](#retrieve-the-order-order-form-settings)cafe24

GET /api/v2/admin/orderform/setting

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve the order/order form settings

*   [Retrieve the order/order form settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update the order/order form settings [](#update-the-order-order-form-settings)cafe24

PUT /api/v2/admin/orderform/setting

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| buy\_limit\_type | 

구매 제한

M:회원만 구매  
A:모두 구매 가능

 |
| guest\_purchase\_button\_display | 

비회원 구매버튼 노출

buy\_limit\_type를 M(회원만 구매)으로 선택 하였을때만 설정 가능

T : 사용함  
F : 사용안함

 |
| junior\_purchase\_block | 

14세 미만 구매 차단

buy\_limit\_type를 A(모두 구매 가능)으로 선택하였을때만 설정 가능

T : 사용함  
F : 사용안함

 |
| reservation\_order | 

예약주문

T : 사용함  
F : 사용안함

 |
| discount\_amount\_display | 

주문상품 할인금액 표시

T : 사용함  
F : 사용안함

 |
| order\_item\_delete | 

주문서 내 상품삭제

T : 사용함  
F : 사용안함

 |
| quick\_signup | 

주문서 간단회원가입

T : 사용함  
F : 사용안함

 |
| check\_order\_info | 

주문서 입력정보 확인

T : 사용함  
F : 사용안함

 |
| order\_form\_input\_type | 

주문서 입력정보 구성

A : 배송정보만 입력  
S : 주문/배송정보 개별입력

 |
| shipping\_info | 

주문서 입력정보 상세설정 > 배송 정보

 |
| 

shipping\_info 하위 요소 보기

**key**  
배송정보 설정항목키  
name(이름)  
address(주소)  
detail\_address(상세주소)  
phone(전화번호)  
cellphone(휴대폰번호)  
shipping\_message(배송메시지)  
email(이메일) : order\_form\_input\_type이 S일때 입력 불가

**use**  
배송정보 설정항목 사용여부

**required**  
배송정보 설정항목 필수여부







 |
| order\_info | 

주문서 입력정보 상세설정 > 주문 정보

order\_form\_input\_type이 A일때 order\_info 입력 불가

 |
| 

order\_info 하위 요소 보기

**key**  
주문정보 설정항목키  
name(이름)  
address(주소)  
detail\_address(상세주소)  
phone(전화번호)  
cellphone(휴대폰번호)  
email(이메일)

**use**  
주문정보 설정항목 사용여부

**required**  
주문정보 설정항목 필수여부







 |
| china\_taiwan\_id\_input | 

중국/대만 신분증 ID 입력

T : 사용함  
F : 사용안함

 |
| print\_type | 

인쇄버튼 타입

 |
| 

print\_type 하위 요소 보기

**invoice\_print**  
거래명세서 인쇄버튼  
T : 표시함  
F : 표시안함

**receipt\_print**  
매출전표 인쇄버튼  
T : 표시함  
F : 표시안함

**address\_print**  
수령지정보 인쇄버튼  
T : 표시함  
F : 표시안함







 |
| orderform\_additional\_enabled | 

주문서 추가항목 사용여부

T:사용  
F:사용안함

 |

Update the order/order form settings

*   [Update the order/order form settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders setting

취소/반품시 자동 수량 복구 및 할인/적립 금액 등 주문 설정에 대해 조회, 수정 할 수 있는 기능입니다.

> Endpoints

```
GET /api/v2/admin/orders/setting
PUT /api/v2/admin/orders/setting
```

#### \[더보기 상세 내용\]

### Orders setting property list[](#orders-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| claim\_request | 

구매자 취소/교환/반품 신청 사용설정

T : 사용함  
F : 사용안함

 |
| claim\_request\_type | 

구매자 취소/교환/반품 신청 시 표시항목 설정

claim\_request 항목이 T일 때만 확인이 가능하다.

S : 기본신청 항목 표시  
D : 상세신청 항목 표시

 |
| claim\_request\_button\_exposure | 

구매자 취소/교환/반품 신청버튼 노출 범위 설정

cancel\_N10 : 취소신청 상품준비중  
cancel\_N20 : 취소신청 배송준비중  
cancel\_N22 : 취소신청 배송보류  
cancel\_N21 : 취소신청 배송대기  
exchange\_N00 : 교환신청 입금전  
exchange\_N10 : 교환신청 상품준비중  
exchange\_N20 : 교환신청 배송준비중  
exchange\_N22 : 교환신청 배송보류  
exchange\_N21 : 교환신청 배송대기  
exchange\_N30 : 교환신청 배송중  
exchange\_N40 : 교환신청 배송완료  
return\_N30 : 반품신청 배송중  
return\_N40 : 반품신청 배송완료

 |
| claim\_request\_button\_date\_type | 

구매자 취소/교환/반품 신청버튼 노출 기준일

order\_date : 주문 완료일 기준  
shipend\_date : 배송완료일 기준

 |
| claim\_request\_button\_period | 

구매자 취소/교환/반품 신청버튼 노출 기간

 |
| stock\_recover | 

취소/반품 시 자동 수량복구

T : 기본 설정  
F : 개별 설정

 |
| stock\_recover\_base | 

취소/반품 시 자동 수량복구 - 기본설정

T : 자동 복구함  
F : 자동 복구 안함  
M : 수량복구 여부를 확인함

 |
| stock\_recover\_individual | 

취소/반품 시 자동 수량복구 - 개별설정

 |
| claim\_request\_auto\_accept | 

구매자 취소/반품 신청 건 자동 접수 설정

T : 사용함  
F : 사용안함

 |
| refund\_benefit\_setting | 

취소/교환/반품 접수 시 할인/적립 금액 설정

 |
| refund\_processing\_setting | 

취소/교환/반품 접수 시 환불 접수 처리 설정

S : 동시에 처리함  
D : 분리하여 처리함

 |
| use\_product\_prepare\_status | 

상품준비중 주문상태 사용여부

T : 사용함  
F : 사용안함

 |
| use\_purchase\_confirmation\_button | 

구매확정 버튼 사용여부

T : 사용함  
F : 사용안함

 |
| purchase\_confirmation\_button\_set\_date | 

구매확정 버튼 적용 날짜

 |
| use\_purchase\_confirmation\_auto\_check | 

구매확정 자동체크 사용여부

T : 사용함  
F : 사용안함

 |
| purchase\_confirmation\_auto\_check\_day | 

구매확정 자동체크 기준일

 |
| purchase\_confirmation\_auto\_check\_set\_date | 

구매확정 자동체크 적용 날짜

 |
| use\_additional\_fields | 

추가항목 사용 여부

T : 사용함  
F : 사용안함

 |
| customer\_pays\_return\_shipping | 

배송 후 교환/반품 신청 시 구매자부담 배송비 결제 사용 여부

T : 사용함  
F : 사용안함

 |
| refund\_bank\_account\_required | 

취소/교환/반품 시 환불계좌정보 등록 필수 여부

T : 필수  
F : 선택

 |
| exchange\_shipping\_fee | 

교환배송비(왕복) 설정

 |
| return\_shipping\_fee | 

반품배송비(편도) 설정

 |
| auto\_delivery\_completion | 

배송완료 일괄체크 설정

T : 사용함  
F : 사용안함

 |
| delivery\_completion\_after\_days | 

배송완료 처리 기준일

 |
| receiver\_address\_modify\_button\_exposure | 

배송지 변경 버튼 노출 범위 설정

N00 : 입금전  
N10 : 상품준비중  
N20 : 배송준비중  
N22 : 배송보류

 |
| auto\_cancel | 

미입금 주문 자동취소 사용설정

T : 사용함  
F : 사용안함

 |
| auto\_cancel\_cash\_unit | 

무통장입금 자동취소 단위

D : 일단위  
T : 시간단위

 |
| auto\_cancel\_cash\_period | 

무통장입금 자동취소 기간

 |
| auto\_cancel\_virtual\_account\_period | 

가상계좌 자동취소 기간

 |
| auto\_cancel\_cvs\_period | 

편의점결제 자동취소 기간

 |
| use\_shipped\_auto\_check\_start\_day | 

배송완료 일괄체크 시작시점 사용여부

 |
| shipped\_auto\_check\_start\_day | 

배송완료 일괄체크 시작일

 |

### Retrieve Order Settings [](#retrieve-order-settings)cafe24

GET /api/v2/admin/orders/setting

###### GET

취소/반품시 자동 수량 복구 및 할인/적립 금액 등 주문 설정에 대해 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve Order Settings

*   [Retrieve Order Settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update Order settings [](#update-order-settings)cafe24

PUT /api/v2/admin/orders/setting

###### PUT

취소/교환/반품 접수 시의 할인/적립 금액 설정을 변경할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| refund\_benefit\_setting | 

취소/교환/반품 접수 시 할인/적립 금액 설정

F: 전체 금액 기준으로 표시  
T: 선택 품목 기준으로 표시  
U: 할인금액 자동계산(설정한 이후 접수된 주문부터 적용)

 |
| use\_product\_prepare\_status | 

상품준비중 주문상태 사용여부

상품준비중 주문상태 사용 설정에 따라서 아래 설정의 '상품준비중' 기능이 제어됨  
\- 배송지 변경 버튼 노출 범위 설정: '상품준비중'  
\- 구매자 취소/교환/반품 신청버튼 노출 범위 설정: '상품준비중'

T : 사용함  
F : 사용안함

 |
| use\_purchase\_confirmation\_button | 

구매확정 버튼 사용여부

T : 사용함  
F : 사용안함

 |
| purchase\_confirmation\_button\_set\_date  

_날짜_

 | 

구매확정 버튼 적용 날짜

 |
| use\_purchase\_confirmation\_auto\_check | 

구매확정 자동체크 사용여부

T : 사용함  
F : 사용안함

 |
| purchase\_confirmation\_auto\_check\_day  

_최소: \[1\]~최대: \[30\]_

 | 

구매확정 자동체크 기준일

 |
| purchase\_confirmation\_auto\_check\_set\_date  

_날짜_

 | 

구매확정 자동체크 적용 날짜

 |
| exchange\_shipping\_fee  

_글자수 최소: \[1자\]~최대: \[9자\]_  
_최소: \[0\]~최대: \[999999999\]_

 | 

교환배송비(왕복) 설정

 |
| return\_shipping\_fee  

_글자수 최소: \[1자\]~최대: \[9자\]_  
_최소: \[0\]~최대: \[999999999\]_

 | 

반품배송비(편도) 설정

 |
| auto\_delivery\_completion | 

배송완료 일괄체크 설정

T : 사용함  
F : 사용안함

 |
| delivery\_completion\_after\_days  

_최소: \[1\]~최대: \[30\]_

 | 

배송완료 처리 기준일

 |
| receiver\_address\_modify\_button\_exposure | 

배송지 변경 버튼 노출 범위 설정

N00 : 입금전  
N10 : 상품준비중  
N20 : 배송준비중  
N22 : 배송보류

 |
| auto\_cancel | 

미입금 주문 자동취소 사용설정

**Youtube shopping 이용 시에는 미제공**

T : 사용함  
F : 사용안함

 |
| auto\_cancel\_cash\_unit | 

무통장입금 자동취소 단위

**Youtube shopping 이용 시에는 미제공**

D : 일단위  
T : 시간단위

 |
| auto\_cancel\_cash\_period  

_최소: \[1\]~최대: \[23\]_

 | 

무통장입금 자동취소 기간

**Youtube shopping 이용 시에는 미제공**

 |
| auto\_cancel\_virtual\_account\_period  

_최소: \[1\]~최대: \[10\]_

 | 

가상계좌 자동취소 기간

**Youtube shopping 이용 시에는 미제공**

 |
| auto\_cancel\_cvs\_period  

_최소: \[1\]~최대: \[10\]_

 | 

편의점결제 자동취소 기간

**Youtube shopping 이용 시에는 미제공**

 |
| claim\_request | 

구매자 취소/교환/반품 신청 사용설정

T : 사용함  
F : 사용안함

 |
| claim\_request\_type | 

구매자 취소/교환/반품 신청 시 표시항목 설정

S : 기본신청 항목 표시  
D : 상세신청 항목 표시

 |
| claim\_request\_button\_exposure | 

구매자 취소/교환/반품 신청버튼 노출 범위 설정

**Youtube shopping 이용 시에는 미제공**

cancel\_N10 : 취소신청 상품준비중  
cancel\_N20 : 취소신청 배송준비중  
cancel\_N22 : 취소신청 배송보류  
cancel\_N21 : 취소신청 배송대기  
exchange\_N00 : 교환신청 입금전  
exchange\_N10 : 교환신청 상품준비중  
exchange\_N20 : 교환신청 배송준비중  
exchange\_N22 : 교환신청 배송보류  
exchange\_N21 : 교환신청 배송대기  
exchange\_N30 : 교환신청 배송중  
exchange\_N40 : 교환신청 배송완료  
return\_N30 : 반품신청 배송중  
return\_N40 : 반품신청 배송완료

 |
| claim\_request\_button\_date\_type | 

구매자 취소/교환/반품 신청버튼 노출 기준일

**Youtube shopping 이용 시에는 미제공**

order\_date : 주문 완료일 기준  
shipend\_date : 배송완료일 기준

 |
| claim\_request\_button\_period  

_최소: \[1\]~최대: \[365\]_

 | 

구매자 취소/교환/반품 신청버튼 노출 기간

**Youtube shopping 이용 시에는 미제공**

 |
| stock\_recover | 

취소/반품 시 자동 수량복구

**Youtube shopping 이용 시에는 미제공**

T : 기본 설정  
F : 개별 설정

 |
| stock\_recover\_base | 

취소/반품 시 자동 수량복구 - 기본설정

**Youtube shopping 이용 시에는 미제공**

T : 자동 복구함  
F : 자동 복구 안함  
M : 수량복구 여부를 확인함

 |
| stock\_recover\_individual | 

취소/반품 시 자동 수량복구 - 개별설정

**Youtube shopping 이용 시에는 미제공**

 |
| 

stock\_recover\_individual 하위 요소 보기

**cancel\_before**  
개별설정 자동수량 복구 - 취소 시(입금전)  
**Youtube shopping 이용 시에는 미제공**  
T : 자동 복구함  
F : 자동 복구 안함  
M : 수량복구 여부를 확인함

**cancel\_after**  
개별설정 자동수량 복구 - 취소 시(입금후)  
**Youtube shopping 이용 시에는 미제공**  
T : 자동 복구함  
F : 자동 복구 안함  
M : 수량복구 여부를 확인함

**cancel\_return**  
개별설정 자동수량 복구 - 반품 시  
**Youtube shopping 이용 시에는 미제공**  
T : 자동 복구함  
F : 자동 복구 안함  
M : 수량복구 여부를 확인함







 |
| refund\_bank\_account\_required | 

취소/교환/반품 시 환불계좌정보 등록 필수 여부

**Youtube shopping 이용 시에는 미제공**

T : 필수  
F : 선택

 |
| refund\_processing\_setting | 

취소/교환/반품 접수 시 환불 접수 처리 설정

**Youtube shopping 이용 시에는 미제공**

S : 동시에 처리함  
D : 분리하여 처리함

 |
| claim\_request\_auto\_accept | 

구매자 취소/반품 신청 건 자동 접수 설정

**Youtube shopping 이용 시에는 미제공**

T : 사용함  
F : 사용안함

 |
| use\_shipped\_auto\_check\_start\_day | 

배송완료 일괄체크 시작시점 사용여부

T : 사용함  
F : 사용안함

 |
| shipped\_auto\_check\_start\_day  

_날짜_

 | 

배송완료 일괄체크 시작일

 |

Update Order settings

*   [Update Order settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders status

쇼핑몰에서 사용하는 주문상태 유형 및 표기를 관리할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orders/status
PUT /api/v2/admin/orders/status
```

#### \[더보기 상세 내용\]

### Orders status property list[](#orders-status-property-list)

| **Attribute** | **Description** |
| --- | --- |
| status\_name\_id | 
주문상태 표기명 일련번호

 |
| status\_type | 

주문상태 유형

P: 결제 및 배송  
D: 후불 결제  
C: 취소  
R: 반품  
E: 교환  
U: 환불  
O: 기타

 |
| basic\_name | 

기본 표기 주문상태명

 |
| custom\_name | 

사용자 정의 주문상태명

 |
| reservation\_custom\_name | 

예약주문 사용자 정의 주문상태명

 |

### Retrieve order status displayed [](#retrieve-order-status-displayed)cafe24

GET /api/v2/admin/orders/status

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve order status displayed

*   [Retrieve order status displayed](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update order status displayed [](#update-order-status-displayed)cafe24

PUT /api/v2/admin/orders/status

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **status\_name\_id**  
**Required** | 

주문상태 표기명 일련번호

 |
| custom\_name | 

사용자 정의 주문상태명

 |
| reservation\_custom\_name | 

예약주문 사용자 정의 주문상태명

 |

Update order status displayed

*   [Update order status displayed](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Payment setting

결제수단의 설정정보를 관리하는 기능을 제공합니다.

> Endpoints

```
GET /api/v2/admin/payment/setting
PUT /api/v2/admin/payment/setting
```

#### \[더보기 상세 내용\]

### Payment setting property list[](#payment-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| use\_escrow | 

에스크로 사용여부

 |
| use\_escrow\_account\_transfer | 

에스크로(계좌이체) 사용여부

 |
| use\_escrow\_virtual\_account | 

에스크로(가상계좌) 사용여부

 |
| pg\_shipping\_registration | 

PG사 배송등록

 |
| purchase\_protection\_amount | 

매매보호 적용 결제금액 설정

 |
| use\_direct\_pay | 

빠른 결제 수단 사용여부

 |
| payment\_display\_type | 

결제수단 표기 방식

T : 텍스트  
L : 로고 아이콘

 |

### Retrieve payment settings [](#retrieve-payment-settings)cafe24 youtube

GET /api/v2/admin/payment/setting

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve payment settings

*   [Retrieve payment settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update payment settings [](#update-payment-settings)cafe24 youtube

PUT /api/v2/admin/payment/setting

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| use\_escrow | 

에스크로 사용여부

T : 사용함  
F : 사용안함

 |
| use\_escrow\_account\_transfer | 

에스크로(계좌이체) 사용여부

T : 사용함  
F : 사용안함

 |
| use\_escrow\_virtual\_account | 

에스크로(가상계좌) 사용여부

T : 사용함  
F : 사용안함

 |
| pg\_shipping\_registration | 

PG사 배송등록

A : 자동 등록(매일 오후 8시 수집)  
M : 수동 등록

 |
| use\_direct\_pay | 

빠른 결제 수단 사용여부

T : 사용함  
F : 사용안함

 |
| payment\_display\_type | 

결제수단 표기 방식

T : 텍스트  
L : 로고 아이콘

 |

Update payment settings

*   [Update payment settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Paymentgateway

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Paymentgateway.png)  
  
PG(Paymentgateway)를 통해 PG앱의 조회, 등록, 수정, 삭제가 가능합니다.

> Endpoints

```
POST /api/v2/admin/paymentgateway
PUT /api/v2/admin/paymentgateway/{client_id}
DELETE /api/v2/admin/paymentgateway/{client_id}
```

#### \[더보기 상세 내용\]

### Paymentgateway property list[](#paymentgateway-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| partner\_id | 

PG사 발급 가맹점 ID

 |
| client\_id | 

앱 클라이언트 ID

 |
| additional\_information | 

추가 정보

 |
| membership\_fee\_type | 

가입비 분류

PRE : 선불  
PAD : 후불  
FREE : 무료

 |
| service\_limit\_type | 

서비스 제한

A : 회원/비회원 제한 없음  
M : 회원만 제공

 |
| review\_status | 

심사상태

AWAITING\_PAYMENT : 결제대기  
PENDING\_REVIEW : 심사대기  
APPROVED : 심사완료

 |
| review\_date | 

심사일자

 |

### Create a Payment Gateway [](#create-a-payment-gateway)cafe24

POST /api/v2/admin/paymentgateway

###### POST

쇼핑몰에 새로운 PG를 등록할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **partner\_id**  
**Required**  

_최대글자수 : \[50자\]_

 | 

PG사 발급 가맹점 ID

 |
| additional\_information  

_배열 최대사이즈: \[5\]_

 | 

추가 정보

 |
| 

additional\_information 하위 요소 보기

**key**  
추가항목 키

**value**  
추가항목 값







 |
| membership\_fee\_type  

_최대글자수 : \[4자\]_

 | 

가입비 분류

PRE : 선불  
PAD : 후불  
FREE : 무료

 |
| service\_limit\_type  

_최대글자수 : \[1자\]_

 | 

서비스 제한

A : 회원/비회원 제한 없음  
M : 회원만 제공

DEFAULT A

 |
| review\_status | 

심사상태

AWAITING\_PAYMENT : 결제대기  
PENDING\_REVIEW : 심사대기  
APPROVED : 심사완료

DEFAULT AWAITING\_PAYMENT

 |

Create a Payment Gateway

*   [Create a Payment Gateway](#none)
*   [Create a payment gateway by using only required fields](#none)
*   [Try creating a payment gateway with same client id](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a Payment Gateway [](#update-a-payment-gateway)cafe24

PUT /api/v2/admin/paymentgateway/{client\_id}

###### PUT

쇼핑몰에 등록된 PG를 수정할 수 있습니다.  
PG사 발급 사맹점 ID, 가입비 여부 등을 수정할 수 있습니다.  
수정을 위해서는 PG앱의 클라이언트 아이디가 필수입니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **client\_id**  
**Required**  

_최대글자수 : \[50자\]_

 | 

앱 클라이언트 ID

 |
| partner\_id  

_최대글자수 : \[50자\]_

 | 

PG사 발급 가맹점 ID

 |
| additional\_information  

_배열 최대사이즈: \[5\]_

 | 

추가 정보

 |
| 

additional\_information 하위 요소 보기

**key**  
추가항목 키

**value**  
추가항목 값







 |
| membership\_fee\_type  

_최대글자수 : \[4자\]_

 | 

가입비 분류

PRE : 선불  
PAD : 후불  
FREE : 무료

 |
| service\_limit\_type  

_최대글자수 : \[1자\]_

 | 

서비스 제한

A : 회원/비회원 제한 없음  
M : 회원만 제공

DEFAULT A

 |
| review\_status | 

심사상태

AWAITING\_PAYMENT : 결제대기  
PENDING\_REVIEW : 심사대기  
APPROVED : 심사완료

 |

Update a Payment Gateway

*   [Update a Payment Gateway](#none)
*   [Update subscription fee type](#none)
*   [Update pg-issued store id(partner id)](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a Payment Gateway [](#delete-a-payment-gateway)cafe24

DELETE /api/v2/admin/paymentgateway/{client\_id}

###### DELETE

쇼핑몰에 등록된 PG를 삭제할 수 있습니다.  
삭제를 위해서는 PG앱의 클라이언트 아이디가 필수입니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **client\_id**  
**Required**  

_최대글자수 : \[50자\]_

 | 

앱 클라이언트 ID

 |

Delete a Payment Gateway

*   [Delete a Payment Gateway](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Paymentgateway paymentmethods

PG의 결제수단(Paymentgateway paymentmethods)은 쇼핑몰에 등록된 PG의 결제수단에 대한 기능입니다.  
특정 PG에서 제공하고 있는 결제수단의 등록, 조회, 수정, 삭제가 가능합니다.  
  
![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Paymentgateway%20paymentmethods.png)

> Endpoints

```
GET /api/v2/admin/paymentgateway/{client_id}/paymentmethods
POST /api/v2/admin/paymentgateway/{client_id}/paymentmethods
PUT /api/v2/admin/paymentgateway/{client_id}/paymentmethods/{payment_method_code}
DELETE /api/v2/admin/paymentgateway/{client_id}/paymentmethods/{payment_method_code}
```

#### \[더보기 상세 내용\]

### Paymentgateway paymentmethods property list[](#paymentgateway__paymentmethods-property-list)

| **Attribute** | **Description** |
| --- | --- |
| client\_id | 
앱 클라이언트 ID

 |
| payment\_method\_code | 

결제수단 코드

 |
| payment\_method | 

결제수단

card : 신용카드  
tcash : 계좌이체  
icash : 가상계좌  
cell : 휴대폰  
cvs : 편의점  
deferpay : 후불결제  
etc : 기타

 |
| payment\_method\_name | 

결제수단명

 |
| payment\_method\_url | 

결제수단 이미지 경로

 |
| available\_shop\_no | 

이용가능한 멀티쇼핑몰 번호

 |

### Retrieve a list of Payment Gateway methods [](#retrieve-a-list-of-payment-gateway-methods)cafe24

GET /api/v2/admin/paymentgateway/{client\_id}/paymentmethods

###### GET

앱으로 설치한 쇼핑몰의 PG에 대해서 지원하는 결제수단을 조회할 수 있습니다.  
결제수단 코드, 결제수단, 결제수단명 등을 조회할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **client\_id**  
**Required**  
_최대글자수 : \[50자\]_

 | 

앱 클라이언트 ID

 |

Retrieve a list of Payment Gateway methods

*   [Retrieve a list of Payment Gateway methods](#none)
*   [Retrieve paymentmethods with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a Payment Gateway method [](#create-a-payment-gateway-method)cafe24

POST /api/v2/admin/paymentgateway/{client\_id}/paymentmethods

###### POST

앱으로 설치한 쇼핑몰의 PG에 대해서 결제수단을 등록할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **client\_id**  
**Required**  
_최대글자수 : \[50자\]_

 | 

앱 클라이언트 ID

 |
| **payment\_method\_code**  
**Required**  

_최대글자수 : \[50자\]_

 | 

결제수단 코드

 |
| **payment\_method**  
**Required** | 

결제수단

card : 신용카드  
tcash : 계좌이체  
icash : 가상계좌  
cell : 휴대폰  
cvs : 편의점  
deferpay : 후불결제  
etc : 기타

 |
| **payment\_method\_name**  
**Required**  

_최대글자수 : \[50자\]_

 | 

결제수단명

 |
| **payment\_method\_url**  
**Required**  

_최대글자수 : \[200자\]_

 | 

결제수단 이미지 경로

지원 확장자 : 'png', 'jpg', 'jpeg'

 |
| available\_shop\_no | 

이용가능한 멀티쇼핑몰 번호

 |

Create a Payment Gateway method

*   [Create a Payment Gateway method](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a payment method of a Payment Gateway [](#update-a-payment-method-of-a-payment-gateway)cafe24

PUT /api/v2/admin/paymentgateway/{client\_id}/paymentmethods/{payment\_method\_code}

###### PUT

앱으로 설치한 쇼핑몰의 PG에 대해서 특정 결제수단을 수정할 수 있습니다.  
결제수단, 결제수단명 등을 수정할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **client\_id**  
**Required**  
_최대글자수 : \[50자\]_

 | 

앱 클라이언트 ID

 |
| **payment\_method\_code**  
**Required**  

_최대글자수 : \[50자\]_

 | 

결제수단 코드

 |
| payment\_method | 

결제수단

card : 신용카드  
tcash : 계좌이체  
icash : 가상계좌  
cell : 휴대폰  
cvs : 편의점  
deferpay : 후불결제  
etc : 기타

 |
| payment\_method\_name  

_최대글자수 : \[50자\]_

 | 

결제수단명

 |
| payment\_method\_url  

_최대글자수 : \[200자\]_

 | 

결제수단 이미지 경로

지원 확장자 : 'png', 'jpg', 'jpeg'

 |
| available\_shop\_no | 

이용가능한 멀티쇼핑몰 번호

 |

Update a payment method of a Payment Gateway

*   [Update a payment method of a Payment Gateway](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a payment method of a Payment Gateway [](#delete-a-payment-method-of-a-payment-gateway)cafe24

DELETE /api/v2/admin/paymentgateway/{client\_id}/paymentmethods/{payment\_method\_code}

###### DELETE

앱으로 설치한 쇼핑몰의 PG에 대해서 특정 결제수단을 삭제할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **client\_id**  
**Required**  
_최대글자수 : \[50자\]_

 | 

앱 클라이언트 ID

 |
| **payment\_method\_code**  
**Required**  

_최대글자수 : \[50자\]_

 | 

결제수단 코드

 |

Delete a payment method of a Payment Gateway

*   [Delete a payment method of a Payment Gateway](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Paymentmethods

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Paymentmethods.png)  
  
쇼핑몰에 설정된 결제수단을 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/paymentmethods
```

#### \[더보기 상세 내용\]

### Paymentmethods property list[](#paymentmethods-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| code | 

결제수단 코드

 |

### Retrieve a list of payment methods [](#retrieve-a-list-of-payment-methods)cafe24

GET /api/v2/admin/paymentmethods

###### GET

쇼핑몰에 설정된 결제수단 목록을 조회합니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve a list of payment methods

*   [Retrieve a list of payment methods](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Paymentmethods paymentproviders

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Paymentmethods%20paymentproviders.png)  
  
쇼핑몰에 설정된 결제수단의 정보를 조회하거나 결제수단의 노출여부를 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/paymentmethods/{code}/paymentproviders
PUT /api/v2/admin/paymentmethods/{code}/paymentproviders/{name}
```

#### \[더보기 상세 내용\]

### Paymentmethods paymentproviders property list[](#paymentmethods__paymentproviders-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| name | 

PG 이름

 |
| display | 

결제수단 노출여부

T : 노출함  
F : 노출안함

 |

### Retrieve a list of providers by payment method [](#retrieve-a-list-of-providers-by-payment-method)cafe24

GET /api/v2/admin/paymentmethods/{code}/paymentproviders

###### GET

쇼핑몰에 설정된 결제수단의 정보를 조회합니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **code**  
**Required** | 

결제수단 코드

 |
| name | 

PG 이름

 |
| display | 

결제수단 노출여부

T : 노출함  
F : 노출안함

 |

Retrieve a list of providers by payment method

*   [Retrieve a list of providers by payment method](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update the display status of a payment method [](#update-the-display-status-of-a-payment-method)cafe24

PUT /api/v2/admin/paymentmethods/{code}/paymentproviders/{name}

###### PUT

쇼핑몰에 설정된 결제수단의 노출여부를 수정합니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **code**  
**Required** | 

결제수단 코드

 |
| **name**  
**Required** | 

PG 이름

 |
| **display**  
**Required** | 

결제수단 노출여부

T : 노출함  
F : 노출안함

 |

Update the display status of a payment method

*   [Update the display status of a payment method](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Paymentservices

국내PG의 세팅사항을 관리할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/paymentservices
```

#### \[더보기 상세 내용\]

### Paymentservices property list[](#paymentservices-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| payment\_gateway\_name | 

PG사 명

 |
| partner\_id | 

PG사 발급 가맹점 ID

 |
| hash\_code | 

PG사 해시코드

 |
| etc\_code | 

PG사 기타정보

 |
| payment\_methods | 

등록 결제수단 리스트

 |

### Retrieve a list of PG settings [](#retrieve-a-list-of-pg-settings)cafe24

GET /api/v2/admin/paymentservices

###### GET

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve a list of PG settings

*   [Retrieve a list of PG settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Points setting

적립금 설정(Points setting)은 적립금 사용에 필요한 설정값을 관리하기 위한 기능입니다.

> Endpoints

```
GET /api/v2/admin/points/setting
PUT /api/v2/admin/points/setting
```

#### \[더보기 상세 내용\]

### Points setting property list[](#points-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| point\_issuance\_standard | 

적립금 지급 기준

C: 배송완료 후  
P: 구매확정 후

 |
| payment\_period | 

적립금 지급 시점

적립금 지급 기준이 C: 배송완료 후 일때 1/3/7/14/20을 입력할 수 있습니다.  
적립금 지급 기준이 P: 구매확정 후 일때 0/1/3/7/14/20을 입력할 수 있습니다.

 |
| name | 

적립금 명칭

 |
| format | 

적립금 표시 방식

 |
| round\_unit | 

적립금 절사 단위

F : 절사안함  
0.01 : 0.01단위  
0.1 : 0.1단위  
1 : 1단위  
10 : 10단위  
100 : 100단위  
1000 : 1000단위

 |
| round\_type | 

적립금 절사 방식

A : 내림  
B : 반올림  
C : 올림

 |
| display\_type | 

적립금 항목 노출 설정

P : 정율  
W : 정액  
WP : 정액/정율  
PW : 정율/정액

 |
| unusable\_points\_change\_type | 

미가용 적립금 변환 기준 설정

M: 최초 상품 배송완료일/구매확정일 기준으로 적립  
T: 마지막 상품 배송완료일/구매확정일 기준으로 적립

 |
| join\_point | 

회원가입 적립금

 |
| use\_email\_agree\_point | 

이메일 수신동의 적립금 사용여부

T:사용함  
F:사용안함

 |
| use\_sms\_agree\_point | 

SMS 수신동의 적립금 사용여부

T:사용함  
F:사용안함

 |
| agree\_change\_type | 

회원가입 시 수신동의 변경타입

T:변경가능  
F:변경불가  
P:일정기간 동안 변경 불가

 |
| agree\_restriction\_period | 

수신동의 변경 불가 기간

1:1개월  
3:3개월  
6:6개월  
12:1년

 |
| agree\_point | 

수신동의 적립금

 |

### Retrieve points settings [](#retrieve-points-settings)cafe24

GET /api/v2/admin/points/setting

###### GET

명칭, 지급 시점, 단위 등의 적립금 설정 값을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve points settings

*   [Retrieve points settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update points settings [](#update-points-settings)cafe24

PUT /api/v2/admin/points/setting

###### PUT

적립금 설정 값을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| point\_issuance\_standard | 

적립금 지급 기준

C: 배송완료 후  
P: 구매확정 후

 |
| payment\_period | 

적립금 지급 시점

적립금 지급 기준이 C: 배송완료 후 일때 1/3/7/14/20을 입력할 수 있습니다.  
적립금 지급 기준이 P: 구매확정 후 일때 0/1/3/7/14/20을 입력할 수 있습니다.

 |
| name | 

적립금 명칭

 |
| format | 

적립금 표시 방식

 |
| round\_unit | 

적립금 절사 단위

화폐단위가 "KRW" "JPY" "TWD" "VND"일때 "적립금 절사 단위"를 F/1/10/100/1000을 입력할 수 있습니다.  
화폐단위가 "KRW" "JPY" "TWD" "VND"가 아닐때 "적립금 절사 단위"를 F/0.01/0.1/1/10을 입력할 수 있습니다.

 |
| round\_type | 

적립금 절사 방식

A : 내림  
B : 반올림  
C : 올림

 |
| display\_type | 

적립금 항목 노출 설정

P : 정율  
W : 정액  
WP : 정액/정율  
PW : 정율/정액

 |
| unusable\_points\_change\_type | 

미가용 적립금 변환 기준 설정

M: 최초 상품 배송완료일/구매확정일 기준으로 적립  
T: 마지막 상품 배송완료일/구매확정일 기준으로 적립

 |
| join\_point | 

회원가입 적립금

 |
| use\_email\_agree\_point | 

이메일 수신동의 적립금 사용여부

T:사용함  
F:사용안함

 |
| use\_sms\_agree\_point | 

SMS 수신동의 적립금 사용여부

T:사용함  
F:사용안함

 |
| agree\_change\_type | 

회원가입 시 수신동의 변경타입

T:변경가능  
F:변경불가  
P:일정기간 동안 변경 불가

 |
| agree\_restriction\_period | 

수신동의 변경 불가 기간

1:1개월  
3:3개월  
6:6개월  
12:1년

 |
| agree\_point | 

수신동의 적립금

 |

Update points settings

*   [Update points settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Policy

쇼핑몰 이용약관 및 개인정보처리방침 약관의 정보를 관리합니다.

> Endpoints

```
GET /api/v2/admin/policy
PUT /api/v2/admin/policy
```

#### \[더보기 상세 내용\]

### Policy property list[](#policy-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| privacy\_all | 

개인정보처리방침 전체내용

 |
| terms\_using\_mall | 

쇼핑몰 이용약관

 |
| use\_privacy\_join | 

회원가입 개인정보처리방침 사용 여부

T: 사용함  
F: 사용안함

 |
| privacy\_join | 

회원가입 개인정보처리방침 내용

 |
| use\_withdrawal | 

청약철회방침 사용여부

T: 사용함  
F: 사용안함

 |
| required\_withdrawal | 

청약철회방침 사용자 동의 필수 여부

T : 필수  
F : 선택

 |
| withdrawal | 

청약철회방침 내용

 |

### Retrieve a store profile [](#retrieve-a-store-profile)cafe24

GET /api/v2/admin/policy

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve a store profile

*   [Retrieve a store profile](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a store profile [](#update-a-store-profile)cafe24

PUT /api/v2/admin/policy

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| save\_type | 

저장 방식

S: 표준 약관 적용  
C: 사용자 정의 약관 적용

DEFAULT S

 |
| privacy\_all | 

개인정보처리방침 전체내용

 |
| terms\_using\_mall | 

쇼핑몰 이용약관

 |
| use\_privacy\_join | 

회원가입 개인정보처리방침 사용 여부

T: 사용함  
F: 사용안함

 |
| privacy\_join | 

회원가입 개인정보처리방침 내용

 |
| use\_withdrawal | 

청약철회방침 사용여부

T: 사용함  
F: 사용안함

 |
| required\_withdrawal | 

청약철회방침 사용자 동의 필수 여부

T : 필수  
F : 선택

 |
| withdrawal | 

청약철회방침 내용

 |

Update a store profile

*   [Update a store profile](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Privacy boards

이용약관 중 게시판 글 작성시점에 대한 개인정보처리방침을 조회할 수 있습니다

> Endpoints

```
GET /api/v2/admin/privacy/boards
PUT /api/v2/admin/privacy/boards
```

#### \[더보기 상세 내용\]

### Privacy boards property list[](#privacy-boards-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| no | 

동의서 번호

 |
| name | 

동의서명

 |
| use | 

사용 여부

T: 사용함  
F: 사용안함

 |
| content | 

동의서 내용

 |

### Retrieve privacy policy for posting on board [](#retrieve-privacy-policy-for-posting-on-board)cafe24

GET /api/v2/admin/privacy/boards

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve privacy policy for posting on board

*   [Retrieve privacy policy for posting on board](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update privacy policy for posting on board [](#update-privacy-policy-for-posting-on-board)cafe24

PUT /api/v2/admin/privacy/boards

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **2** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **no**  
**Required**  

_최소값: \[1\]_

 | 

동의서 번호

 |
| use | 

사용 여부

T: 사용함  
F: 사용안함

 |
| save\_type | 

저장 방식

S: 표준 약관 적용  
C: 사용자 정의 약관 적용

 |
| content | 

동의서 내용

 |

Update privacy policy for posting on board

*   [Update privacy policy for posting on board](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Privacy join

이용약관 중 회원가입시점에 대한 개인정보처리방침을 조회할 수 있습니다

> Endpoints

```
GET /api/v2/admin/privacy/join
PUT /api/v2/admin/privacy/join
```

#### \[더보기 상세 내용\]

### Privacy join property list[](#privacy-join-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| no | 

동의서 번호

 |
| name | 

동의서명

 |
| use | 

사용 여부

T: 사용함  
F: 사용안함

 |
| required | 

필수/선택 여부

T : 필수  
F : 선택

 |
| display | 

동의서 표시 화면

JOIN: 회원가입  
SIMPLE\_ORDER\_JOIN: 주문서 간단 회원가입  
SHOPPING\_PAY\_EASY\_JOIN: 쇼핑페이 간편가입

 |
| content | 

동의서 내용

 |

### Retrieve privacy policy for signup [](#retrieve-privacy-policy-for-signup)cafe24

GET /api/v2/admin/privacy/join

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve privacy policy for signup

*   [Retrieve privacy policy for signup](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update privacy policy for signup [](#update-privacy-policy-for-signup)cafe24

PUT /api/v2/admin/privacy/join

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **no**  
**Required**  

_최소값: \[1\]_

 | 

동의서 번호

 |
| use | 

사용 여부

T: 사용함  
F: 사용안함

 |
| required | 

필수/선택 여부

T : 필수  
F : 선택

 |
| display | 

동의서 표시 화면

JOIN: 회원가입  
SIMPLE\_ORDER\_JOIN: 주문서 간단 회원가입  
SHOPPING\_PAY\_EASY\_JOIN: 쇼핑페이 간편가입

 |
| save\_type | 

저장 방식

S: 표준 약관 적용  
C: 사용자 정의 약관 적용

 |
| content | 

동의서 내용

 |

Update privacy policy for signup

*   [Update privacy policy for signup](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Privacy orders

이용약관 중 주문시점에 대한 개인정보처리방침을 조회할 수 있습니다

> Endpoints

```
GET /api/v2/admin/privacy/orders
PUT /api/v2/admin/privacy/orders
```

#### \[더보기 상세 내용\]

### Privacy orders property list[](#privacy-orders-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| no | 

동의서 번호

 |
| name | 

동의서명

 |
| use | 

사용 여부

T: 사용함  
F: 사용안함

 |
| use\_member | 

회원 구매 시 사용 여부

T: 사용함  
F: 사용안함

 |
| use\_non\_member | 

비회원 구매 시 사용 여부

T: 사용함  
F: 사용안함

 |
| content | 

동의서 내용

 |

### Retrieve privacy policy for checkout [](#retrieve-privacy-policy-for-checkout)cafe24

GET /api/v2/admin/privacy/orders

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve privacy policy for checkout

*   [Retrieve privacy policy for checkout](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update privacy policy for checkout [](#update-privacy-policy-for-checkout)cafe24

PUT /api/v2/admin/privacy/orders

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **2** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **no**  
**Required**  

_최소값: \[1\]_

 | 

동의서 번호

 |
| use | 

사용 여부

T: 사용함  
F: 사용안함

 |
| use\_member | 

회원 구매 시 사용 여부

T: 사용함  
F: 사용안함

 |
| use\_non\_member | 

비회원 구매 시 사용 여부

T: 사용함  
F: 사용안함

 |
| save\_type | 

저장 방식

S: 표준 약관 적용  
C: 사용자 정의 약관 적용

 |
| content | 

동의서 내용

 |

Update privacy policy for checkout

*   [Update privacy policy for checkout](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products display setting

상품 화면 설정(Products display setting)은 상품 목록 화면에서 상품 정보의 노출 방식을 설정하는 기능입니다.

> Endpoints

```
GET /api/v2/admin/products/display/setting
PUT /api/v2/admin/products/display/setting
```

#### \[더보기 상세 내용\]

### Products display setting property list[](#products-display-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| sorting\_options | 

상품정렬조건

new\_product : 신상품  
product\_name : 상품명  
low\_price : 낮은가격  
high\_price : 높은가격  
manufacture : 제조사  
popular\_product : 인기상품  
review : 사용후기  
hit\_count : 조회수  
like\_count : 좋아요

 |

### List all products display setting [](#list-all-products-display-setting)cafe24

GET /api/v2/admin/products/display/setting

###### GET

상품정렬조건 설정을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

List all products display setting

*   [List all products display setting](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a products display setting [](#update-a-products-display-setting)cafe24

PUT /api/v2/admin/products/display/setting

###### PUT

상품정렬조건 설정을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **sorting\_options**  
**Required** | 

상품정렬조건

new\_product : 신상품  
product\_name : 상품명  
low\_price : 낮은가격  
high\_price : 높은가격  
manufacture : 제조사  
popular\_product : 인기상품  
review : 사용후기  
hit\_count : 조회수  
like\_count : 좋아요

 |

Update a products display setting

*   [Update a products display setting](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products properties setting

상품 상세 화면에 표시되는 항목의 추가 설정을 조회하고 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/products/properties/setting
PUT /api/v2/admin/products/properties/setting
```

#### \[더보기 상세 내용\]

### Products properties setting property list[](#products-properties-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| strikethrough\_retail\_price | 

소비자가 취소선 표시

 |
| strikethrough\_price | 

판매가 취소선 표시

 |
| product\_tax\_type\_text | 

판매가 부가세 표시문구

 |
| product\_discount\_price\_text | 

할인판매가 할인금액 표시문구

 |
| optimum\_discount\_price\_text | 

최적할인가 할인금액 표시문구

 |

### Retrieve additional settings for product details [](#retrieve-additional-settings-for-product-details)cafe24

GET /api/v2/admin/products/properties/setting

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve additional settings for product details

*   [Retrieve additional settings for product details](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update additional settings for product details [](#update-additional-settings-for-product-details)cafe24

PUT /api/v2/admin/products/properties/setting

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| strikethrough\_retail\_price | 

소비자가 취소선 표시

T : 사용함  
F : 사용안함

 |
| strikethrough\_price | 

판매가 취소선 표시

T : 사용함  
F : 사용안함

 |
| product\_tax\_type\_text | 

판매가 부가세 표시문구

 |
| 

product\_tax\_type\_text 하위 요소 보기

**use**  
사용 여부  
T : 사용함  
F : 사용안함

**color**  
글자 색상

**font\_size**  
글자 크기

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)







 |
| product\_discount\_price\_text | 

할인판매가 할인금액 표시문구

 |
| 

product\_discount\_price\_text 하위 요소 보기

**use**  
사용 여부  
T : 사용함  
F : 사용안함

**color**  
글자 색상

**font\_size**  
글자 크기

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)







 |
| optimum\_discount\_price\_text | 

최적할인가 할인금액 표시문구

 |
| 

optimum\_discount\_price\_text 하위 요소 보기

**use**  
사용 여부  
T : 사용함  
F : 사용안함

**color**  
글자 색상

**font\_size**  
글자 크기

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)







 |

Update additional settings for product details

*   [Update additional settings for product details](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products setting

상품의 설정(Products setting)은 상품의 판매가 등의 설정값에 대한 기능입니다.

> Endpoints

```
GET /api/v2/admin/products/setting
```

#### \[더보기 상세 내용\]

### Products setting property list[](#products-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| display\_price\_scope | 

회원/비회원 가격표시

A : 모두 표시함 (회원+비회원)  
C : 회원만 표시함

 |
| calculate\_price\_based\_on | 

판매가 계산 기준

S : 공급가 대비 마진율  
A : 판매가 대비 마진율  
P : 기본몰 판매가  
B : 상품가

 |
| price\_rounding\_unit | 

판매가 계산 절사 단위

F : 절사안함  
\-2 : 0.01단위  
\-1 : 0.1단위  
0 : 1단위  
1 : 10단위  
2 : 100단위  
3 : 1000단위

 |
| price\_rounding\_rule | 

판매가 계산 절사 방법

L : 내림  
U : 반올림  
C : 올림

 |
| auto\_translation | 

자동 번역 항목 사용여부

T:사용  
F:사용안함

 |
| translation\_items | 

자동 번역 항목

product\_name : 상품명  
summary\_description : 상품요약설명  
simple\_description : 상품간략설명  
description : 상품상세설명  
category\_name : 상품 분류  
option : 옵션  
material : 상품소재

 |
| popular\_search\_keywords  

_배열 최대사이즈: \[10\]_

 | 

인기검색어

 |
| popup\_menu | 

팝업 메뉴

T : 사용함  
F : 사용안함

 |
| display\_sub\_category | 

분류 리스트 표시

T : 사용함  
F : 사용안함

 |
| display\_sub\_category\_detail | 

하위분류 표시단계 상세설정

 |
| display\_product\_count | 

상품 수 표시

T : 사용함  
F : 사용안함

 |
| option\_preview | 

옵션 미리보기 기능

T : 사용함  
F : 사용안함

 |
| wishlist\_registration | 

관심상품 등록 기능

T : 사용함  
F : 사용안함

 |
| additional\_image\_action | 

추가이미지 액션

C : 마우스 클릭  
O : 마우스 오버

 |
| image\_effect | 

상품이미지 효과 설정

T : 사용함  
F : 사용안함

 |
| image\_effect\_detail | 

상품이미지 효과 상세설정

 |

### Retrieve product settings [](#retrieve-product-settings)cafe24

GET /api/v2/admin/products/setting

###### GET

상품의 판매가에 대한 설정값을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve product settings

*   [Retrieve product settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Redirects

특정 URL로 접속 했을때, 설정한 URL로 리다이렉트할 수 있는 리소스입니다.

> Endpoints

```
GET /api/v2/admin/redirects
POST /api/v2/admin/redirects
PUT /api/v2/admin/redirects/{id}
DELETE /api/v2/admin/redirects/{id}
```

#### \[더보기 상세 내용\]

### Redirects property list[](#redirects-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_  
_최대값: \[2147483647\]_

 | 

멀티쇼핑몰 번호

 |
| id  

_최대값: \[2147483647\]_

 | 

리다이렉트 아이디

 |
| path | 

리다이렉트 경로

 |
| target | 

대상 위치

 |

### Retrieve a list of redirects [](#retrieve-a-list-of-redirects)cafe24

GET /api/v2/admin/redirects

###### GET

등록된 Redirect URL을 조회할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_  
_최대값: \[2147483647\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| id  

_최소값: \[1\]_  
_최대값: \[2147483647\]_

 | 

리다이렉트 아이디

 |
| path | 

리다이렉트 경로

 |
| target | 

대상 위치

 |

Retrieve a list of redirects

*   [Retrieve a list of redirects](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a redirect [](#create-a-redirect)cafe24

POST /api/v2/admin/redirects

###### POST

Redirect URL을 등록할 수 있습니다.  
샵별 최대 1000개 등록이 가능합니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **10** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_  
_최대값: \[2147483647\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **path**  
**Required** | 

리다이렉트 경로

 |
| **target**  
**Required** | 

대상 위치

 |

Create a redirect

*   [Create a redirect](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a redirect [](#update-a-redirect)cafe24

PUT /api/v2/admin/redirects/{id}

###### PUT

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **10** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_  
_최대값: \[2147483647\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **id**  
**Required**  

_최소값: \[1\]_  
_최대값: \[2147483647\]_

 | 

리다이렉트 아이디

 |
| path | 

리다이렉트 경로

 |
| target | 

대상 위치

 |

Update a redirect

*   [Update a redirect](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a redirect [](#delete-a-redirect)cafe24

DELETE /api/v2/admin/redirects/{id}

###### DELETE

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_  
_최대값: \[2147483647\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **id**  
**Required**  

_최소값: \[1\]_  
_최대값: \[2147483647\]_

 | 

리다이렉트 아이디

 |

Delete a redirect

*   [Delete a redirect](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Restocknotification setting

재입고 알림 상품의 설정 관리할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/restocknotification/setting
PUT /api/v2/admin/restocknotification/setting
```

#### \[더보기 상세 내용\]

### Restocknotification setting property list[](#restocknotification-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| use | 

사용 여부

T:사용  
F:사용안함

 |
| is\_button\_show | 

버튼 노출 여부

T:노출함  
F:노출안함

 |
| expiration\_period | 

알림 유효기간 설정

1:1개월  
3:3개월  
6:6개월  
12:1년

 |
| button\_show\_target | 

버튼 노출 대상

A:모두 노출  
M:회원만 노출

 |
| show\_message\_to\_non\_members  

_최대글자수 : \[30자\]_

 | 

비회원 메시지

 |
| send\_method | 

발송 방법

A:자동발송  
M:수동발송

 |
| button\_show\_method | 

버튼 진열 타입

P:상품별  
G:품목별

 |
| available\_product | 

버튼 노출 상품

A:전체상품  
P:특정상품  
E:제외상품

 |
| available\_product\_list  

_배열 최대사이즈: \[200\]_

 | 

버튼 노출 상품 리스트

 |

### Retrieve restocknotification settings [](#retrieve-restocknotification-settings)cafe24

GET /api/v2/admin/restocknotification/setting

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve restocknotification settings

*   [Retrieve restocknotification settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Updated restocknotification settings [](#updated-restocknotification-settings)cafe24

PUT /api/v2/admin/restocknotification/setting

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| use | 

사용 여부

T:사용  
F:사용안함

 |
| is\_button\_show | 

버튼 노출 여부

T:노출함  
F:노출안함

 |
| expiration\_period | 

알림 유효기간 설정

1:1개월  
3:3개월  
6:6개월  
12:1년

 |
| button\_show\_target | 

버튼 노출 대상

A:모두 노출  
M:회원만 노출

 |
| show\_message\_to\_non\_members  

_최대글자수 : \[30자\]_

 | 

비회원 메시지

 |
| send\_method | 

발송 방법

A:자동발송  
M:수동발송

 |
| button\_show\_method | 

버튼 진열 타입

P:상품별  
G:품목별

 |
| available\_product | 

버튼 노출 상품

A:전체상품  
P:특정상품  
E:제외상품

 |
| available\_product\_list  

_배열 최대사이즈: \[200\]_

 | 

버튼 노출 상품 리스트

 |

Updated restocknotification settings

*   [Updated restocknotification settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Seo setting

SEO 설정(Seo setting)은 검색결과 상위에 쇼핑몰이 노출되고 방문자가 증가하도록 하는 검색엔진 최적화(SEO) 작��입니다.

> Endpoints

```
GET /api/v2/admin/seo/setting
PUT /api/v2/admin/seo/setting
```

#### \[더보기 상세 내용\]

### Seo setting property list[](#seo-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| common\_page\_title | 

공통페이지 title 태그

 |
| common\_page\_meta\_description | 

공통페이지 description 태그

 |
| favicon  

_URL_

 | 

파비콘

 |
| use\_google\_search\_console | 

구글 서치 콘솔 사용여부

T : 사용함  
F : 사용안함

 |
| google\_search\_console | 

구글 서치 콘솔

 |
| use\_naver\_search\_advisor | 

네이버 서치 어드바이저 사용여부

T : 사용함  
F : 사용안함

 |
| naver\_search\_advisor | 

네이버 서치 어드바이저

 |
| sns\_share\_image  

_URL_

 | 

SNS 공유 이미지

 |
| use\_twitter\_card | 

트위터 카드 사용여부

T : 사용함  
F : 사용안함

 |
| robots\_text | 

검색로봇 접근 제어(PC)

 |
| mobile\_robots\_text | 

검색로봇 접근 제어(모바일)

 |
| use\_missing\_page\_redirect | 

없는 페이지 연결 리다이렉션 여부(PC)

T : 사용함  
F : 사용안함

 |
| missing\_page\_redirect\_url | 

없는 페이지 연결 리다이렉션 연결 경로(PC)

 |
| mobile\_use\_missing\_page\_redirect | 

없는 페이지 연결 리다이렉션 여부(모바일)

T : 사용함  
F : 사용안함

 |
| mobile\_missing\_page\_redirect\_url | 

없는 페이지 연결 리다이렉션 연결 경로(모바일)

 |
| use\_sitemap\_auto\_update | 

사이트맵 사용여부

T : 사용함  
F : 사용안함

 |
| use\_rss | 

RSS 피드 사용여부

T : 사용함  
F : 사용안함

 |
| display\_group | 

메인분류 명

 |
| header\_tag | 

Head HTML(PC)

 |
| footer\_tag | 

Body HTML(PC)

 |
| mobile\_header\_tag | 

Head HTML(모바일)

 |
| mobile\_footer\_tag | 

Body HTML(모바일)

 |
| og\_main | 

메인 화면 설정

 |
| og\_product | 

상품 상세 설정

 |
| og\_category | 

상품 분류 설정

 |
| og\_board | 

게시판 설정

 |
| llms\_text | 

AI 크롤러 접근 제어

 |

### Retrieve SEO settings [](#retrieve-seo-settings)cafe24

GET /api/v2/admin/seo/setting

###### GET

쇼핑몰의 검색엔진 최적화(SEO) 설정을 조회합니다.  
메타 태그, 파비콘, 검색로봇 접근 제어 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve SEO settings

*   [Retrieve SEO settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update store SEO settings [](#update-store-seo-settings)cafe24

PUT /api/v2/admin/seo/setting

###### PUT

쇼핑몰의 검색엔진 최적화(SEO) 설정을 수정합니다.  
메타 태그, 파비콘, 검색로봇 접근 제어 등을 설정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| common\_page\_title | 

공통페이지 title 태그

 |
| common\_page\_meta\_description | 

공통페이지 description 태그

 |
| favicon  

_URL_

 | 

파비콘

 |
| use\_google\_search\_console | 

구글 서치 콘솔 사용여부

T : 사용함  
F : 사용안함

 |
| google\_search\_console | 

구글 서치 콘솔

 |
| use\_naver\_search\_advisor | 

네이버 서치 어드바이저 사용여부

T : 사용함  
F : 사용안함

 |
| naver\_search\_advisor | 

네이버 서치 어드바이저

 |
| sns\_share\_image  

_URL_

 | 

SNS 공유 이미지

 |
| use\_twitter\_card | 

트위터 카드 사용여부

T : 사용함  
F : 사용안함

 |
| robots\_text | 

검색로봇 접근 제어(PC)

 |
| mobile\_robots\_text | 

검색로봇 접근 제어(모바일)

 |
| use\_missing\_page\_redirect | 

없는 페이지 연결 리다이렉션 여부(PC)

T : 사용함  
F : 사용안함

 |
| missing\_page\_redirect\_url | 

없는 페이지 연결 리다이렉션 연결 경로(PC)

 |
| mobile\_use\_missing\_page\_redirect | 

없는 페이지 연결 리다이렉션 여부(모바일)

T : 사용함  
F : 사용안함

 |
| mobile\_missing\_page\_redirect\_url | 

없는 페이지 연결 리다이렉션 연결 경로(모바일)

 |
| use\_sitemap\_auto\_update | 

사이트맵 사용여부

T : 사용함  
F : 사용안함

 |
| use\_rss | 

RSS 피드 사용여부

T : 사용함  
F : 사용안함

 |
| display\_group | 

메인분류 명

 |
| header\_tag | 

Head HTML(PC)

 |
| footer\_tag | 

Body HTML(PC)

 |
| mobile\_header\_tag | 

Head HTML(모바일)

 |
| mobile\_footer\_tag | 

Body HTML(모바일)

 |
| og\_main | 

메인 화면 설정

 |
| 

og\_main 하위 요소 보기

**site\_name**  
사이트 이름

**title**  
제목

**description**  
페이지 설명







 |
| og\_product | 

상품 상세 설정

 |
| 

og\_product 하위 요소 보기

**site\_name**  
사이트 이름

**title**  
제목

**description**  
페이지 설명







 |
| og\_category | 

상품 분류 설정

 |
| 

og\_category 하위 요소 보기

**site\_name**  
사이트 이름

**title**  
제목

**description**  
페이지 설명







 |
| og\_board | 

게시판 설정

 |
| 

og\_board 하위 요소 보기

**site\_name**  
사이트 이름

**title**  
제목

**description**  
페이지 설명







 |
| llms\_text | 

AI 크롤러 접근 제어

 |

Update store SEO settings

*   [Update store SEO settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Shippingmanager

배송 관리자(Shippingmanager)는 배송 관리자 활성화 정보 관련 기능입니다.  
배송 관리자의 사용 정보를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/shippingmanager
```

#### \[더보기 상세 내용\]

### Shippingmanager property list[](#shippingmanager-property-list)

| **Attribute** | **Description** |
| --- | --- |
| use | 
배송 관리자 활성화 정보

 |

### Retrieve activation information for Shipping Manager [](#retrieve-activation-information-for-shipping-manager)cafe24

GET /api/v2/admin/shippingmanager

###### GET

배송 관리자의 사용 정보를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

Retrieve activation information for Shipping Manager

*   [Retrieve activation information for Shipping Manager](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Shops

멀티쇼핑몰(Shops)은 한개의 몰아이디에서 두개 이상의 쇼핑몰을 운영하고 있는 경우 생성한 멀티 쇼핑몰의 정보입니다.  
멀티쇼핑몰은 최대 15개까지 생성이 가능하며, 각각 다른 언어와 화폐로 생성할 수 있어 다국어 쇼핑몰을 운영하기 용이합니다.

> Endpoints

```
GET /api/v2/admin/shops
GET /api/v2/admin/shops/{shop_no}
```

#### \[더보기 상세 내용\]

### Shops property list[](#shops-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| default | 

기본샵 여부

기본샵 여부 구분

T : 기본샵  
F : 기본샵 아님

 |
| shop\_name  

_최대글자수 : \[255자\]_

 | 

쇼핑몰명

해당 멀티쇼핑몰의 쇼핑몰 이름

 |
| business\_country\_code | 

사업자 거점 국가 코드

[business\_country\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/business_country_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| language\_code | 

언어 코드

멀티쇼핑몰의 기본 언어 코드

ko\_KR : 국문  
en\_US : 영문  
zh\_CN : 중문(간체)  
zh\_TW : 중문(번체)  
ja\_JP : 일문  
vi\_VN : 베트남어

 |
| language\_name  

_최대글자수 : \[20자\]_

 | 

기본 언어명

멀티쇼핑몰의 기본 언어명

 |
| currency\_code  

_형식 : \[A-Z\]_

 | 

결제 화폐 코드

멀티쇼핑몰의 결제 화폐 코드

South Korean Won (KRW)  
United States Dollar (USD)  
Japanese Yen (JPY)  
Chinese Yuan (CNY)  
Taiwan Dollar (TWD)  
Euro (EUR)  
Brazilian Real (BRL)  
Vietnamese Dong (VND)

 |
| currency\_name | 

결제 화폐명

멀티쇼핑몰의 결제 화폐명

 |
| reference\_currency\_code  

_형식 : \[A-Z\]_

 | 

참조 화폐 코드

멀티쇼핑몰의 참조 화폐 코드

South Korean Won (KRW)  
United States Dollar (USD)  
Japanese Yen (JPY)  
Chinese Yuan (CNY)

 |
| reference\_currency\_name | 

참조 화폐명

멀티쇼핑몰의 참조 화폐명

 |
| pc\_skin\_no | 

PC 쇼핑몰 대표 디자인 번호

멀티쇼핑몰의 PC 쇼핑몰 대표 디자인 번호. 현재 쇼핑몰에서 사용하고 있는 디자인 번호를 나타낸다.

 |
| mobile\_skin\_no | 

모바일 쇼핑몰 대표 디자인 번호

모바일 쇼핑몰 대표 디자인 번호. 현재 쇼핑몰에서 사용하고 있는 디자인 번호를 나타낸다.

 |
| base\_domain  

_최대글자수 : \[63자\]_

 | 

기본제공 도메인

기본제공하는 도메인

 |
| primary\_domain  

_최대글자수 : \[63자\]_

 | 

대표도메인

멀티쇼핑몰 대표 도메인

 |
| slave\_domain | 

연결 도메인

쇼핑몰에 연결된 도메인

 |
| active | 

활성화 여부

멀티쇼핑몰 활성화 여부

T : 활성화  
F : 비활성화

 |
| timezone | 

표준시간대(타임존)

 |
| timezone\_name | 

표준시간대 정보

 |
| date\_format | 

표준시간대 날짜 표시형식

년/월/일 : YYYY-MM-DD  
월/일/년 : MM-DD-YYYY  
일/월/년 : DD-MM-YYYY

 |
| time\_format | 

표준시간대 시간 표시형식

시/분/초 표시 : hh:mm:ss  
시/분 표시 : hh:mm

 |
| unit\_system | 

단위 체계

metric : 메트릭 체계  
imperial : 야드파운드법

 |
| weight\_unit | 

중량 단위

kg : 킬로그램  
g : 그램  
lb : 파운드  
oz : 온스

 |
| use\_reference\_currency | 

참조화폐 사용여부

 |
| is\_https\_active | 

HTTPS 활성화 여부

T : 활성화  
F : 비활성화

 |
| site\_connect | 

사이트 접속설정

 |
| channel | 

채널

 |
| use\_translation | 

자동번역

 |

### Retrieve a list of shops [](#retrieve-a-list-of-shops)cafe24

GET /api/v2/admin/shops

###### GET

쇼핑몰에 등록된 멀티쇼핑몰의 정보를 목록으로 조회할 수 있습니다.  
쇼핑몰명, 기본샵 여부, 기본 언어명 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

Retrieve a list of shops

*   [Retrieve a list of shops](#none)
*   [Retrieve shops with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a shop [](#retrieve-a-shop)cafe24 youtube

GET /api/v2/admin/shops/{shop\_no}

###### GET

쇼핑몰에 등록된 멀티쇼핑몰의 정보를 조회할 수 있습니다.  
쇼핑몰명, 언어, 결제 화폐정보 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **shop\_no**  
**Required** | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |

Retrieve a shop

*   [Retrieve a shop](#none)
*   [Retrieve a shop with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Sms setting

SMS 설정(Sms setting)은 쇼핑몰의 SMS 설정에 관한 기능입니다.  
SMS API를 사용하기 위해서는 먼저 쇼핑몰에서 SMS 발송 서비스를 사용하고 있는지 확인이 필요합니다.

> Endpoints

```
GET /api/v2/admin/sms/setting
PUT /api/v2/admin/sms/setting
```

#### \[더보기 상세 내용\]

### Sms setting property list[](#sms-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| use\_sms | 

SMS 사용 여부

T: 사용함  
F: 사용안함

 |
| exclude\_unsubscriber | 

수신거부자 제외 발송 여부

T : 제외  
F : 포함

 |
| default\_sender | 

기본 발신번호

 |
| unsubscribe\_phone | 

무료 수신거부 전화번호

 |
| send\_method | 

SMS 발송방법

S: 단문 분할발송  
L: 장문발송(3건 차감)

 |
| send\_method\_automatic | 

SMS 발송방법 (자동)

L: 장문발송(3건차감)  
S: 단문 분할발송  
N: 단문발송

 |

### Retrieve SMS settings [](#retrieve-sms-settings)cafe24 youtube

GET /api/v2/admin/sms/setting

###### GET

쇼핑몰의 SMS 설정을 조회할 수 있습니다.  
\*\*해당 API는 한국어 쇼핑몰에서만 사용 가능합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve SMS settings

*   [Retrieve SMS settings](#none)
*   [Try to retrieve SMS setting for the shop that does not provide SMS service](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update SMS settings [](#update-sms-settings)cafe24 youtube

PUT /api/v2/admin/sms/setting

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| use\_sms | 

SMS 사용 여부

T: 사용함  
F: 사용안함

 |
| exclude\_unsubscriber | 

수신거부자 제외 발송 여부

T : 제외  
F : 포함

 |
| default\_sender  

_최대글자수 : \[14자\]_

 | 

기본 발신번호

 |
| unsubscribe\_phone  

_최대글자수 : \[14자\]_

 | 

무료 수신거부 전화번호

 |
| send\_method | 

SMS 발송방법

S: 단문 분할발송  
L: 장문발송(3건 차감)

 |
| send\_method\_automatic | 

SMS 발송방법 (자동)

L: 장문발송(3건차감)  
S: 단문 분할발송  
N: 단문발송

 |

Update SMS settings

*   [Update SMS settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Socials apple

애플아이디 로그인(Socials apple)은 쇼핑몰 이용 고객의 애플아이디 로그인에 관한 기능입니다.  
애플아이디 로그인 설정을 사용하기 위해서는 먼저 애플의 개발자 계정에서 Sign in with Apple 앱 설정을 완료하여야 합니다.

> Endpoints

```
GET /api/v2/admin/socials/apple
PUT /api/v2/admin/socials/apple
```

#### \[더보기 상세 내용\]

### Socials apple property list[](#socials-apple-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| use\_apple\_login | 

애플 로그인 사용

T : 사용함  
F : 사용안함

 |
| client\_id | 

client id

 |
| team\_id | 

Team ID

 |
| key\_id | 

Key ID

 |
| auth\_key\_file\_name | 

Auth Key 파일명

 |
| use\_certification | 

애플 로그인 본인인증

T : 사용함  
F : 사용안함

 |

### Apple login sync details [](#apple-login-sync-details)cafe24

GET /api/v2/admin/socials/apple

###### GET

쇼핑몰 이용 고객의 애플 로그인 연동정보를 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Apple login sync details

*   [Apple login sync details](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Apple login sync settings [](#apple-login-sync-settings)cafe24

PUT /api/v2/admin/socials/apple

###### PUT

쇼핑몰 이용 고객의 애플 로그인 연동정보를 수정합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| use\_apple\_login | 

애플 로그인 사용

T : 사용함  
F : 사용안함

 |
| client\_id  

_최대글자수 : \[300자\]_

 | 

Client ID

애플 개발자 센터의 Service ID 생성 시 설정한 Identifier

 |
| team\_id  

_최대글자수 : \[300자\]_

 | 

Team ID

애플 개발자 센터의 App ID Prefix

 |
| key\_id  

_최대글자수 : \[300자\]_

 | 

Key ID

애플 개발자 센터의 Key ID

 |
| auth\_key\_file\_name  

_최대글자수 : \[30자\]_

 | 

Auth Key 파일명

App ID의 Key파일로 .p8파일만 가능

 |
| auth\_key\_file\_contents  

_최대글자수 : \[300자\]_

 | 

Auth Key 파일 내용

.p8파일을 텍스트 파일로 열어 줄바꿈 없이 값을 작성

 |
| use\_certification | 

애플 로그인 본인인증

T : 사용함  
F : 사용안함

 |

Apple login sync settings

*   [Apple login sync settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Socials kakaosync

카카오싱크 SNS(Socials kakaosync)는 쇼핑몰의 카카오싱크에 대한 설정을 조회하거나 설정할 수 있는 기능입니다.

> Endpoints

```
GET /api/v2/admin/socials/kakaosync
PUT /api/v2/admin/socials/kakaosync
```

#### \[더보기 상세 내용\]

### Socials kakaosync property list[](#socials-kakaosync-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| use\_kakaosync | 

카카오싱크 사용여부

T : 사용함  
F : 사용안함

 |
| rest\_api\_key | 

REST API 키

 |
| javascript\_key | 

JavaScript 키

 |
| auto\_login | 

자동 로그인 사용

카카오 웹브라우저로 쇼핑몰 이용시 카카오 아이디로 로그인 기능 사용 여부

T : 사용함  
F : 사용안함

 |
| thirdparty\_agree | 

제3자 제공 동의 여부

T : 동의함  
F : 동의안함

 |
| thirdparty\_agree\_date | 

제3자 제공 동의 날짜

 |
| use\_signup\_result\_page | 

쇼핑몰 가입 후 이동 페이지

T : 가입 완료 페이지로 이동  
F : 가입 완료 페이지 없이 즉시 가입

 |

### Kakao Sync details [](#kakao-sync-details)cafe24

GET /api/v2/admin/socials/kakaosync

###### GET

쇼핑몰의 카카오싱크에 대한 설정을 조회할 수 있습니다.  
카카오싱크 사용여부, 자동 로그인 사용여부 등을 조회할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Kakao Sync details

*   [Kakao Sync details](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Kakao Sync updates [](#kakao-sync-updates)cafe24

PUT /api/v2/admin/socials/kakaosync

###### PUT

카카오 웹브라우져에 대한 자동 로그인 기능의 사용여부를 수정할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **rest\_api\_key**  
**Required**  

_형식 : \[a-zA-Z0-9\]_  
_최대글자수 : \[255자\]_

 | 

REST API 키

 |
| **javascript\_key**  
**Required**  

_형식 : \[a-zA-Z0-9\]_  
_최대글자수 : \[255자\]_

 | 

JavaScript 키

 |
| auto\_login | 

자동 로그인 사용

카카오 웹브라우저로 쇼핑몰 이용시 카카오 아이디로 로그인 기능 사용 여부

T : 사용함  
F : 사용안함

DEFAULT F

 |
| use\_signup\_result\_page | 

쇼핑몰 가입 후 이동 페이지

T : 가입 완료 페이지로 이동  
F : 가입 완료 페이지 없이 즉시 가입

DEFAULT F

 |

Kakao Sync updates

*   [Kakao Sync updates](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Socials naverlogin

네이버 로그인 설정정보를 조회하고 설정정보를 변경하는 리소스입니다.

> Endpoints

```
GET /api/v2/admin/socials/naverlogin
PUT /api/v2/admin/socials/naverlogin
```

#### \[더보기 상세 내용\]

### Socials naverlogin property list[](#socials-naverlogin-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| use\_naverlogin | 

네이버 로그인 사용여부

 |
| client\_id | 

클라이언트 아이디

 |
| client\_secret | 

클라이언트 시크릿 키

 |

### Naver login details [](#naver-login-details)cafe24

GET /api/v2/admin/socials/naverlogin

###### GET

쇼핑몰에 네이버 로그인 설정여부를 조회할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Naver login details

*   [Naver login details](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update Naver login settings [](#update-naver-login-settings)cafe24

PUT /api/v2/admin/socials/naverlogin

###### PUT

쇼핑몰에 설정된 네이버 로그인 정보를 수정할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **use\_naverlogin**  
**Required** | 

네이버 로그인 사용여부

T:사용함  
F:사용안함

 |
| client\_id  

_형식 : \[a-zA-Z0-9\_-\]_  
_최대글자수 : \[255자\]_

 | 

클라이언트 아이디

 |
| client\_secret  

_형식 : \[a-zA-Z0-9\_-\]_  
_최대글자수 : \[255자\]_

 | 

클라이언트 시크릿 키

 |

Update Naver login settings

*   [Update Naver login settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Socials navershopping

> Endpoints

```
GET /api/v2/admin/socials/navershopping
```

#### \[더보기 상세 내용\]

### Socials navershopping property list[](#socials-navershopping-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| **mall\_id**  
**Required** | 

몰아이디

 |
| **service\_status**  
**Required** | 

서비스 상태

T:사용함  
F:사용안함

 |

### NAVER Shopping settings [](#naver-shopping-settings)cafe24

GET /api/v2/admin/socials/navershopping

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

NAVER Shopping settings

*   [NAVER Shopping settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Store

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Store.png)  
  
상점(Store)은 쇼핑몰의 쇼핑몰명, 관리자 정보, 사업자 등록번호와 고객센터 전화번호 등 쇼핑몰의 기본적인 정보를 확인할 수 있는 기능입니다.

> Endpoints

```
GET /api/v2/admin/store
```

#### \[더보기 상세 내용\]

### Store property list[](#store-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| shop\_name | 

쇼핑몰명

해당 상점의 쇼핑몰명(\[쇼핑몰 설정 > 기본 설정 > '쇼핑몰 정보 > 내 쇼핑몰 정보'\])

 |
| admin\_name | 

관리자명

쇼핑몰의 대표운영자의 이름

 |
| mall\_id | 

상점 아이디

쇼핑몰 아이디. 대표운영자의 아이디이자, 쇼핑몰 기본 제공 도메인(mallid.cafe24.com)에 사용한다.

 |
| base\_domain | 

기본제공 도메인

쇼핑몰 생성시 자동으로 생성되는 기본제공 도메인 정보. 해당 도메인을 통해 쇼핑몰에 접근할 수 있다.

 |
| primary\_domain | 

대표도메인

쇼핑몰에 연결한 대표도메인. 대표도메인을 연결하였을 경우에만 노출된다.

 |
| company\_registration\_no | 

사업자등록번호

사업장이 위치한 국가에서 발급한 쇼핑몰의 사업자 등록 번호.

 |
| company\_name | 

상호명

사업자 등록시 등록한 상호명 또는 법인명.

 |
| president\_name | 

대표자명

사업자 등록시 등록한 대표자명.

 |
| company\_condition | 

업태

사업자 등록시 등록한 업태.

 |
| company\_line | 

종목

사업자 등록시 등록한 종목.

 |
| country | 

사업장 국가

사업장이 있는 국가명.

 |
| country\_code | 

국가코드

 |
| zipcode | 

우편번호

사업장의 우편번호

 |
| address1 | 

기본 주소

사업장 주소(시/군/도)

 |
| address2 | 

상세 주소

사업장 주소(상세 주소)

 |
| phone | 

전화번호

 |
| fax | 

팩스번호

 |
| email | 

이메일

운영자가 자동메일을 수신할 경우 수신할 메일 주소

 |
| notification\_only\_email | 

발신전용 이메일

고객과 운영자에게 자동메일 발송시 보내는 사람 메일주소

 |
| mall\_url | 

쇼핑몰 주소

 |
| mail\_order\_sales\_registration | 

통신 판매업 신고

통신판매업 신고가 되었는지 신고 여부

T : 신고함  
F : 신고안함

 |
| mail\_order\_sales\_registration\_number | 

통신판매신고 번호

 |
| missing\_report\_reason\_type | 

통신판매업 미신고 사유

통신판매업 신고를 하지 않았을 경우 해당 사유.

 |
| missing\_report\_reason | 

통신판매업 미신고 사유 상세 내용

통신판매업 미신고 사유가 "기타"일 경우 상세 사유.

 |
| about\_us\_contents | 

회사소개

쇼핑몰에 대한 간략한 소개 표시. 쇼핑몰의 회사 소개 화면에 표시된다.

 |
| company\_map\_url | 

회사약도

쇼핑몰에 대한 간략한 약도 표시. 쇼핑몰의 회사 소개 화면에 표시된다.

 |
| customer\_service\_phone | 

고객센터 상담/주문 전화

쇼핑몰 화면에 표시되는 고객센터 상담 전화

 |
| customer\_service\_email | 

고객센터 상담/주문 이메일

쇼핑몰 화면에 표시되는 고객센터 상담 이메일 주소.

 |
| customer\_service\_fax | 

고객센터 팩스 번호

쇼핑몰 화면에 표시되는 고객센터 팩스 번호.

 |
| customer\_service\_sms | 

고객센터 SMS 수신번호

쇼핑몰 화면에 표시되는 고객센터 SMS 수신 번호.

 |
| customer\_service\_hours | 

고객센터 운영시간

쇼핑몰 화면에 표시되는 고객센터 운영시간.

 |
| privacy\_officer\_name | 

개인정보보호 책임자명

쇼핑몰 화면에 표시되는 개인정보보호 책임자 이름.

 |
| privacy\_officer\_position | 

개인정보보호 책임자 지위

 |
| privacy\_officer\_department | 

개인정보보호 책임자 부서

 |
| privacy\_officer\_phone | 

개인정보보호 책임자 연락처

쇼핑몰 화면에 표시되는 개인정보보호 책임자의 전화번호.

 |
| privacy\_officer\_email | 

개인정보보호 책임자 이메일

쇼핑몰 화면에 표시되는 개인정보보호 책임자의 이메일 주소.

 |
| contact\_us\_mobile | 

서비스 문의안내 모바일 표시여부

서비스 문의 안내를 모바일에 노출시킬 것인지 여부.

T : 표시함  
F : 표시안함

 |
| contact\_us\_contents | 

서비스 문의안내 내용

상품상세 페이지에 노출시키는 서비스 문의 안내 내용.

 |
| sales\_product\_categories | 

판매 상품 카테고리

회원가입 및 쇼핑몰 생성 직후 입력하는 판매 상품 카테고리의 정보를 조회할 수 있습니다.  
  
(2023년 4월 이후 가입한 몰에 한하여 조회할 수 있습니다.)

Undecided : 아직 결정하지 못했어요.  
Apparel : 패션의류  
FashionAccessories : 패션잡화  
LuxuryGoods : 수입명품  
BrandApparel : 브랜드의류  
BrandAccessories : 브랜드잡화  
Food\_Beverage : 식품  
Lifestyle\_HealthCare : 생활/건강  
Furniture\_HomeDecor : 가구/인테리어  
Beauty\_PersonalCare : 화장품/미용  
Maternity\_BabyProducts : 출산/육아  
Digital\_HomeAppliances : 디지털/가전  
CarAccessories : 자동차  
Rentals : 렌탈 서비스  
Sports\_Leisure : 스포츠/레저  
CD\_DVD : 음반/DVD  
Books : 도서  
Travels\_Services : 여가/생활편의  
Used\_Refurbished\_Exhibition : 중고/리퍼/전시  
Others : 기타/서비스

 |
| category\_tags | 

판매 상품 카테고리 태그

[category\_tags](https://d2wxkjpieznxai.cloudfront.net/resource/ko/product_category_keywords.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| business\_country | 

비즈니스 국가

 |
| youtube\_shops\_logo | 

유튜브쇼핑 로고 이미지

 |

### Retrieve store details [](#retrieve-store-details)cafe24 youtube

GET /api/v2/admin/store

###### GET

쇼핑몰의 정보를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |

Retrieve store details

*   [Retrieve store details](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Store accounts

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Store%20accounts.png)  
  
상점 계좌(Store accounts)는 쇼핑몰의 무통장입금 정보에 대한 기능입니다.

> Endpoints

```
GET /api/v2/admin/store/accounts
```

#### \[더보기 상세 내용\]

### Store accounts property list[](#store-accounts-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| bank\_account\_id | 

무통장 입금 은행 ID

 |
| bank\_name | 

은행명

 |
| bank\_code  

_최대글자수 : \[50자\]_

 | 

은행코드

[bank\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/bank_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| bank\_account\_no | 

계좌번호

 |
| bank\_account\_holder | 

예금주

 |
| use\_account | 

사용여부

T : 사용함  
F : 사용안함

 |

### Retrieve a list of store bank accounts [](#retrieve-a-list-of-store-bank-accounts)cafe24

GET /api/v2/admin/store/accounts

###### GET

상점의 무통장입금 계좌정보를 목록으로 조회할 수 있습니다.  
은행명, 은행코드, 계좌번호 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve a list of store bank accounts

*   [Retrieve a list of store bank accounts](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Store dropshipping

> Endpoints

```
GET /api/v2/admin/store/dropshipping
PUT /api/v2/admin/store/dropshipping
```

#### \[더보기 상세 내용\]

### Store dropshipping property list[](#store-dropshipping-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| name | 

드롭쉬핑 공급사명

 |
| use | 

드롭쉬핑 계정연동 여부

T : 연동함  
F : 연동안함

 |

### Retrieve dropshipping settings [](#retrieve-dropshipping-settings)cafe24

GET /api/v2/admin/store/dropshipping

###### GET

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve dropshipping settings

*   [Retrieve dropshipping settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Manage dropshipping settings [](#manage-dropshipping-settings)cafe24

PUT /api/v2/admin/store/dropshipping

###### PUT

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **name**  
**Required**  

_최대글자수 : \[50자\]_

 | 

드롭쉬핑 공급사명

 |
| **use**  
**Required** | 

드롭쉬핑 계정연동 여부

T : 연동함  
F : 연동안함

 |

Manage dropshipping settings

*   [Manage dropshipping settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Store setting

> Endpoints

```
GET /api/v2/admin/store/setting
PUT /api/v2/admin/store/setting
```

#### \[더보기 상세 내용\]

### Store setting property list[](#store-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| name\_input\_style | 

이름 입력 방식

SEPARATE: 성/이름 각각 입력  
COMBINED: 성/이름 한번에 입력

 |

### Retrieve store security settings [](#retrieve-store-security-settings)cafe24

GET /api/v2/admin/store/setting

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve store security settings

*   [Retrieve store security settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Edit store security settings [](#edit-store-security-settings)cafe24

PUT /api/v2/admin/store/setting

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **30** |
| 1���당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| name\_input\_style | 

이름 입력 방식

SEPARATE: 성/이름 각각 입력  
COMBINED: 성/이름 한번에 입력

 |

Edit store security settings

*   [Edit store security settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Subscription shipments setting

정기배송 설정(Subscription shipments setting)은 정기결제를 통해 이루어지는 정기배송에 대한 기능입니다.  
정기배송 설정을 통해 쇼핑몰의 정기배송 상품을 설정하거나 정기배송 상품을 조회할 수 있습니다.  
정기배송 기능을 사용하기 위해서는 먼저 정기배송 서비스가 신청되어 있어야 합니다.  
정기배송 서비스의 신청은 어드민에서 가능합니다.

> Endpoints

```
GET /api/v2/admin/subscription/shipments/setting
POST /api/v2/admin/subscription/shipments/setting
PUT /api/v2/admin/subscription/shipments/setting/{subscription_no}
DELETE /api/v2/admin/subscription/shipments/setting/{subscription_no}
```

#### \[더보기 상세 내용\]

### Subscription shipments setting property list[](#subscription-shipments-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| subscription\_no | 

정기배송 상품설정 번호

 |
| subscription\_shipments\_name | 

정기배송 상품설정 명

 |
| product\_binding\_type | 

정기배송 상품 설정

A : 전체상품  
P : 개별상품  
C : 상품분류

 |
| one\_time\_purchase | 

1회구매 제공여부

T : 제공함  
F : 제공안함

 |
| product\_list | 

적용 상품

 |
| category\_list | 

적용 분류

 |
| use\_discount | 

정기배송 할인 사용여부

T : 사용함  
F : 사용안함

 |
| discount\_value\_unit | 

할인 기준

P : 할인율  
W : 할인 금액

 |
| discount\_values | 

할인 값

 |
| related\_purchase\_quantity | 

구매수량 관계 여부

T : 구매수량에 따라  
F : 구매수량에 관계없이

 |
| subscription\_shipments\_cycle\_type | 

배송주기 제공여부

T : 사용함  
F : 사용안함

 |
| subscription\_shipments\_cycle | 

배송주기

1W : 1주  
2W : 2주  
3W : 3주  
4W : 4주  
1M : 1개월  
2M : 2개월  
3M : 3개월  
4M : 4개월  
5M : 5개월  
6M : 6개월  
1Y : 1년

 |
| subscription\_shipments\_count\_type | 

정기배송 횟수 설정

T : 사용함  
F : 사용안함

 |
| subscription\_shipments\_count | 

정기배송 횟수

2 : 2회  
3 : 3회  
4 : 4회  
6 : 6회  
8 : 8회  
10 : 10회  
12 : 12회

 |
| use\_order\_price\_condition | 

혜택제공금액기준 사용여부

T : 사용함  
F : 사용안함

 |
| order\_price\_greater\_than | 

혜택제공금액기준 제공 기준금액

 |
| include\_regional\_shipping\_rate | 

지역별배송비 포함여부

T : 포함  
F : 미포함

 |
| shipments\_start\_date  

_최소값: \[1\]_  
_최대값: \[30\]_

 | 

배송시작일 설정

 |
| change\_option | 

옵션 변경 가능 여부

T : 사용함  
F : 사용안함

 |

### Retrieve a list of subscription products [](#retrieve-a-list-of-subscription-products)cafe24

GET /api/v2/admin/subscription/shipments/setting

###### GET

설정된 정기배송 상품에 대한 정보를 목록으로 조회할 수 있습니다.  
정기배송 상품설정 번호, 설정 명, 설정값 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| subscription\_no | 

정기배송 상품설정 번호

 |

Retrieve a list of subscription products

*   [Retrieve a list of subscription products](#none)
*   [Retrieve setting with fields parameter](#none)
*   [Retrieve a specific setting with subscription\_no parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a subscription payment rule [](#create-a-subscription-payment-rule)cafe24

POST /api/v2/admin/subscription/shipments/setting

###### POST

정기배송 상품을 설정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **subscription\_shipments\_name**  
**Required**  

_최대글자수 : \[255자\]_

 | 

정기배송 상품설정 명

 |
| **product\_binding\_type**  
**Required** | 

정기배송 상품 설정

A : 전체상품  
P : 개별상품  
C : 상품분류

 |
| one\_time\_purchase | 

1회구매 제공여부

T : 제공함  
F : 제공안함

DEFAULT T

 |
| product\_list  

_배열 최대사이즈: \[10000\]_

 | 

적용 상품

 |
| category\_list  

_배열 최대사이즈: \[1000\]_

 | 

적용 분류

 |
| **use\_discount**  
**Required** | 

정기배송 할인 사용여부

T : 사용함  
F : 사용안함

 |
| discount\_value\_unit | 

할인 기준

P : 할인율  
W : 할인 금액

 |
| discount\_values  

_배열 최대사이즈: \[40\]_

 | 

할인 값

discount\_value\_unit이 P일 경우 최대값 : 100  
discount\_value\_unit이 W일 경우 최대값 : 99999999999999

 |
| 

discount\_values 하위 요소 보기

**delivery\_cycle**  
**Required**  
적용회차

**discount\_amount**  
**Required**  
할인 값







 |
| related\_purchase\_quantity | 

구매수량 관계 여부

T : 구매수량에 따라  
F : 구매수량에 관계없이

 |
| **subscription\_shipments\_cycle\_type**  
**Required** | 

배송주기 제공여부

T : 사용함  
F : 사용안함

 |
| **subscription\_shipments\_cycle**  
**Required** | 

배송주기

1W : 1주  
2W : 2주  
3W : 3주  
4W : 4주  
1M : 1개월  
2M : 2개월  
3M : 3개월  
4M : 4개월  
5M : 5개월  
6M : 6개월  
1Y : 1년

 |
| subscription\_shipments\_count\_type | 

정기배송 횟수 설정

T : 사용함  
F : 사용안함

 |
| subscription\_shipments\_count  

_배열 최대사이즈: \[7\]_

 | 

정기배송 횟수

2 : 2회  
3 : 3회  
4 : 4회  
6 : 6회  
8 : 8회  
10 : 10회  
12 : 12회

 |
| **use\_order\_price\_condition**  
**Required** | 

혜택제공금액기준 사용여부

T : 사용함  
F : 사용안함

 |
| order\_price\_greater\_than  

_최대값: \[99999999999999\]_

 | 

혜택제공금액기준 제공 기준금액

 |
| include\_regional\_shipping\_rate | 

지역별배송비 포함여부

T : 포함  
F : 미포함

 |
| shipments\_start\_date  

_최소값: \[1\]_  
_최대값: \[30\]_

 | 

배송시작일 설정

DEFAULT 3

 |
| change\_option | 

옵션 변경 가능 여부

T : 사용함  
F : 사용안함

DEFAULT F

 |

Create a subscription payment rule

*   [Create a subscription payment rule](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update subscription products [](#update-subscription-products)cafe24

PUT /api/v2/admin/subscription/shipments/setting/{subscription\_no}

###### PUT

설정된 정기배송 상품의 정기배송 설정을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **subscription\_no**  
**Required** | 

정기배송 상품설정 번호

 |
| subscription\_shipments\_name  

_최대글자수 : \[255자\]_

 | 

정기배송 상품설정 명

 |
| product\_binding\_type | 

정기배송 상품 설정

A : 전체상품  
P : 개별상품  
C : 상품분류

 |
| one\_time\_purchase | 

1회구매 제공여부

T : 제공함  
F : 제공안함

 |
| product\_list  

_배열 최대사이즈: \[10000\]_

 | 

적용 상품

 |
| category\_list  

_배열 최대사이즈: \[1000\]_

 | 

적용 분류

 |
| use\_discount | 

정기배송 할인 사용여부

T : 사용함  
F : 사용안함

 |
| discount\_value\_unit | 

할인 기준

P : 할인율  
W : 할인 금액

 |
| discount\_values  

_배열 최대사이즈: \[40\]_

 | 

할인 값

 |
| 

discount\_values 하위 요소 보기

**delivery\_cycle**  
**Required**  
적용회차

**discount\_amount**  
**Required**  
할인 값







 |
| related\_purchase\_quantity | 

구매수량 관계 여부

T : 구매수량에 따라  
F : 구매수량에 관계없이

 |
| subscription\_shipments\_cycle\_type | 

배송주기 제공여부

T : 사용함  
F : 사용안함

 |
| subscription\_shipments\_cycle | 

배송주기

1W : 1주  
2W : 2주  
3W : 3주  
4W : 4주  
1M : 1개월  
2M : 2개월  
3M : 3개월  
4M : 4개월  
5M : 5개월  
6M : 6개월  
1Y : 1년

 |
| subscription\_shipments\_count\_type | 

정기배송 횟수 설정

T : 사용함  
F : 사용안함

 |
| subscription\_shipments\_count  

_배열 최대사이즈: \[7\]_

 | 

정기배송 횟수

2 : 2회  
3 : 3회  
4 : 4회  
6 : 6회  
8 : 8회  
10 : 10회  
12 : 12회

 |
| use\_order\_price\_condition | 

혜택제공금액기준 사용여부

T : 사용함  
F : 사용안함

 |
| order\_price\_greater\_than  

_최대값: \[99999999999999\]_

 | 

혜택제공금액기준 제공 기준금액

 |
| include\_regional\_shipping\_rate | 

지역별배송비 포함여부

T : 포함  
F : 미포함

 |
| shipments\_start\_date  

_최소값: \[1\]_  
_최대값: \[30\]_

 | 

배송시작일 설정

 |
| change\_option | 

옵션 변경 가능 여부

T : 사용함  
F : 사용안함

 |

Update subscription products

*   [Update subscription products](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete subscription products [](#delete-subscription-products)cafe24

DELETE /api/v2/admin/subscription/shipments/setting/{subscription\_no}

###### DELETE

설정된 정기배송 상품의 정기배송 설정을 해제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 쓰기권한 (mall.write\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **subscription\_no**  
**Required** | 

정기배송 상품설정 번호

 |

Delete subscription products

*   [Delete subscription products](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Taxmanager

세금 관리자(MSA)의 활성화 정보 관련 기능입니다.

> Endpoints

```
GET /api/v2/admin/taxmanager
```

#### \[더보기 상세 내용\]

### Taxmanager property list[](#taxmanager-property-list)

| **Attribute** | **Description** |
| --- | --- |
| use | 
세금 관리자 활성화 정보

 |

### Retrieve activation information for Tax Manager [](#retrieve-activation-information-for-tax-manager)cafe24

GET /api/v2/admin/taxmanager

###### GET

세금 관리자의 사용 정보를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

Retrieve activation information for Tax Manager

*   [Retrieve activation information for Tax Manager](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Users

운영자(Users)는 쇼핑몰의 대표관리자와 더불어 쇼핑몰을 운영할 수 있는 운영자와 관련된 기능입니다.  
부운영자는 대표관리자가 부여한 권한 내에서 쇼핑몰을 운영할 수 있습니다.  
쇼핑몰에 등록된 운영자를 목록으로 조회하거나 특정 운영자를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/users
GET /api/v2/admin/users/{user_id}
```

#### \[더보기 상세 내용\]

### Users property list[](#users-property-list)

| **Attribute** | **Description** |
| --- | --- |
| user\_id | 
운영자 아이디

운영자 혹은 부운영자의 아이디

 |
| user\_name | 

운영자 명

운영자 혹은 부운영자의 이름

 |
| phone  

_전화번호_

 | 

전화번호

운영자 혹은 부운영자의 ���화번호

 |
| email  

_이메일_

 | 

이메일

운영자 혹은 부운영자의 이메일 주소

 |
| ip\_restriction\_type | 

IP 접근제한

IP 접근제한의 사용여부

A : 사용함  
F : 사용안함

 |
| admin\_type | 

운영자 구분

대표운영자인지 부운영자인지의 구분

P : 대표운영자  
A : 부운영자

 |
| last\_login\_date | 

최근 접속일시

 |
| shop\_no  

_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| nick\_name | 

운영자 별명

운영자의 별명

 |
| nick\_name\_icon\_type | 

별명 아이콘 타입

별명 아이콘 등록. 직접 등록이나 샘플 등록이 가능함.

D : 직접 아이콘 등록  
S : 샘플 아이콘 등록

 |
| nick\_name\_icon\_url | 

별명 아이콘 URL

 |
| board\_exposure\_setting | 

게시판 노출 설정

 |
| memo | 

메모

 |
| available | 

사용여부

T : 사용함  
F : 사용안함

 |
| multishop\_access\_authority | 

멀티쇼핑몰 접근 권한

T : 허용함  
F : 허용안함

 |
| menu\_access\_authority | 

메뉴 접근 권한

 |
| detail\_authority\_setting | 

상세 권한 설정

 |
| ip\_access\_restriction | 

IP 접근 제한

 |
| access\_permission | 

접속 허용 권한

T : 접속 허용시간 설정과 상관없이 항상 관리자 페이지 접속을 허용함  
F : 사용안함

 |
| admin\_language | 

어드민 언어

ko\_KR : 한국어  
en\_US : 영어  
ja\_JP : 일본어

 |

### Retrieve a list of admin users [](#retrieve-a-list-of-admin-users)cafe24 youtube

GET /api/v2/admin/users

###### GET

쇼핑몰에 등록된 운영자를 목록으로 조회할 수 있습니다.  
운영자 아이디, 운영자명, 이메일, 전화번호 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| search\_type | 
검색 타입

member\_Id : 회원 아이디  
name : 이름

 |
| keyword | 

검색어

 |
| admin\_type | 

운영자 구분

P : 대표운영자  
A : 부운영자

 |

Retrieve a list of admin users

*   [Retrieve a list of admin users](#none)
*   [Retrieve users with fields parameter](#none)
*   [Retrieve a specific users with search\_type and keyword parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve admin user details [](#retrieve-admin-user-details)cafe24 youtube

GET /api/v2/admin/users/{user\_id}

###### GET

쇼핑몰에 등록된 특정 운영자를 조회할 수 있습니다.  
운영자 이름, 전화번호, 이메일 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상점 읽기권한 (mall.read\_store)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| user\_id | 

운영자 아이디

운영자 혹은 부운영자의 아이디

 |

Retrieve admin user details

*   [Retrieve admin user details](#none)
*   [Retrieve an user with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Product

## Bundleproducts

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Bundleproducts.png)  
  
세트상품(Bunldeproducts)은 여러 개의 상품을 묶어서 판매하는 상품을 의미합니다.  
세트 상품은 상품을 각각 주문하는 것보다 더 싸게 구입할 수 있도록 추가 할인을 설정할 수 있습니다.  
세트상품 주문시에는 하나의 상품처럼 주문을 관리할 수 있습니다.  
세트상품 리소스에서는 세트상품만 조회하거나, 세트상품 등록/수정/삭제를 진행할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/bundleproducts
GET /api/v2/admin/bundleproducts/{product_no}
POST /api/v2/admin/bundleproducts
PUT /api/v2/admin/bundleproducts/{product_no}
DELETE /api/v2/admin/bundleproducts/{product_no}
```

#### \[더보기 상세 내용\]

### Bundleproducts property list[](#bundleproducts-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| product\_no | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| product\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

상품코드

시스템이 상품에 부여한 코드. 해당 쇼핑몰 내에서 상품코드는 중복되지 않음.

 |
| bundle\_product\_components | 

세트상품의 구성상품 정보

 |
| custom\_product\_code  

_최대글자수 : \[40자\]_

 | 

자체상품 코드

사용자가 상품에 부여 가능한 코드. 재고 관리등의 이유로 자체적으로 상품을 관리 하고 있는 경우 사용함.

 |
| product\_name  

_최대글자수 : \[250자\]_

 | 

상품명

상품의 이름. 상품명은 상품을 구분하는 가장 기초적인 정보이며 검색 정보가 된다. HTML을 사용하여 입력이 가능하다.

 |
| eng\_product\_name  

_최대글자수 : \[250자\]_

 | 

영문 상품명

상품의 영문 이름. 해외 배송 등에 사용 가능함.

 |
| supply\_product\_name  

_최대글자수 : \[250자\]_

 | 

공급사 상품명

공급사에서 등록한 상품의 이름. 공급사에서 상품의 구분을 위해 임의로 입력할 수 있으며 상품명에는 영향을 미치지 않는다.

 |
| internal\_product\_name  

_최대글자수 : \[50자\]_

 | 

상품명(관리용)

 |
| model\_name  

_최대글자수 : \[100자\]_

 | 

모델명

상품의 모델명.

 |
| display | 

진열상태

상품을 쇼핑몰에 진열할지 여부. 상품을 쇼핑몰에 진열할 경우 설정한 상품분류와 메인화면에 표시된다. 상품이 쇼핑몰에 진열되어 있지 않으면 쇼핑몰 화면에 표시되지 않아 접근할 수 없으며 상품을 구매할 수 없다.

T : 진열함  
F : 진열안함

 |
| selling | 

판매상태

상품을 쇼핑몰에 판매할지 여부. 상품을 진열한 상태로 판매를 중지할 경우 상품은 쇼핑몰에 표시되지만 "품절"로 표시되어 상품을 구매할 수 없다. 상품이 "진열안함"일 경우 "판매함" 상태여도 상품에 접근할 수 없기 때문에 구매할 수 없다.

T : 판매함  
F : 판매안함

 |
| product\_condition | 

상품 상태

판매하는 상품의 상태 표시.

N : 신상품  
B : 반품상품  
R : 재고상품  
U : 중고상품  
E : 전시상품  
F : 리퍼상품  
S : 스크래치 상품

 |
| product\_used\_month  

_최대값: \[2147483647\]_

 | 

중고상품 사용 개월

 |
| summary\_description  

_최대글자수 : \[255자\]_

 | 

상품요약설명

상품에 대한 요약 정보. 상품 진열 화면에서 노출 가능한 설명. HTML을 사용하여 입력이 가능하다.  
\[쇼핑몰 설정 > 상품 설정 > '상품 보기 설정 > 상품 정보 표시 설정'\]에서 노출되도록 설정 가능하다.

 |
| product\_tag | 

상품 검색어

검색 또는 분류를 위하여 상품에 입력하는 검색어 정보(해시태그)

 |
| price\_content  

_최대글자수 : \[20자\]_

 | 

판매가 대체문구

상품의 가격 대신 표시되는 문구. 품절이나 상품이 일시적으로 판매 불가할 때 사용.

 |
| buy\_limit\_by\_product | 

구매제한 개별 설정여부

T : 사용함  
F : 사용안함

 |
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

 |
| buy\_group\_list | 

구매가능 회원 등급

 |
| buy\_member\_id\_list | 

구매가능 회원아이디

 |
| repurchase\_restriction | 

재구매 제한

T : 재구매 불가  
F : 제한안함

 |
| single\_purchase\_restriction | 

단독구매 제한

T : 단독구매 불가  
F : 제한안함

 |
| single\_purchase | 

단독구매 설정

T : 단독구매 불가  
F : 제한안함  
O : 단독구매 전용

 |
| points\_by\_product | 

적립금 개별설정 사용여부

F : ���본설정 사용  
T : 개별설정

 |
| points\_setting\_by\_payment | 

결제방식별 적립금 설정 여부

B : 기본 적립금설정 사용  
C : 결제방식에 따른 적립

 |
| points\_amount | 

적립금 설정 정보

 |
| except\_member\_points | 

회원등급 추가 적립 제외

T : 회원등급 추가 적립 제외 설정함  
F : 회원등급 추가 적립 제외 설정안함

 |
| adult\_certification | 

성인인증

성인인증이 필요한 상품인지 여부. 성인인증이 필요한 상품인 구매를 위해서는 본인인증을 거쳐야함.

T : 사용함  
F : 사용안함

 |
| detail\_image | 

상세이미지

상품 상세 화면에 표시되는 상품 이미지.

 |
| list\_image | 

목록이미지

상품 분류 화면, 메인 화면, 상품 검색 화면에 표시되는 상품의 목록 이미지.

 |
| tiny\_image | 

작은목록이미지

최근 본 상품 영역에 표시되는 상품의 목록 이미지.

 |
| small\_image | 

축소이미지

상품 상세 화면 하단에 표시되는 상품 목록 이미지.

 |
| use\_naverpay | 

네이버페이 사용여부

T : 사용함  
F : 사용안함

 |
| naverpay\_type | 

네이버페이 판매타입

C : 네이버페이 + 쇼핑몰 동시판매 상품  
O : 네이버페이 전용상품

 |
| icon\_show\_period | 

아이콘 노출 기간

상품에 설정한 아이콘이 노출되는 기간.

 |
| icon  

_배열 최대사이즈: \[5\]_

 | 

아이콘

상품에 표시되는 아이콘. 상품 판매를 강조하기 위한 목적으로 사용이 가능함.

 |
| hscode | 

HS코드

해외 배송시 관세 부과를 위해 사용하는 HS코드. 국제 배송시 통관을 위해 반드시 정확한 번호를 입력해야 함.  
  
※ HS코드 : 세계무역기구(WTO) 및 세계관세기구(WCO)가 무역통계 및 관세분류의 목적상 수출입 상품을 숫자 코드로 분류화 한 것으로, 수입 시 세금부과와 수출품의 통제 및 통계를 위한 분류법

 |
| product\_weight | 

상품 중량

상품의 전체 중량(kg). 배송을 위해 상품 자체의 무게와 박스 무게, 포장무게를 모두 포함한 중량 기재가 필요하다.

 |
| product\_material | 

상품소재

상품의 소재. 복합 소재일 경우 상품의 소재와 함유랑을 함께 입력해야함. (예 : 면 80%, 레이온 20%)

 |
| created\_date | 

생성일

상품이 생성된 일시.

 |
| updated\_date | 

수정일

상품이 수정된 일시.

 |
| english\_product\_material | 

영문 상품 소재

상품의 소재의 영어 표기. 해외 배송사를 이용할 경우 의류의 소재를 통관시 요구하는 경우가 있음.

 |
| cloth\_fabric | 

옷감

상품이 의류인 경우, 옷감. 일본 택배사를 이용할 경우, 택배사에 따라 의류 통관시 옷감 정보를 입력 받는 경우가 있음.

woven : 직물(woven)  
knit : 편물(knit)

 |
| list\_icon | 

추천 / 품절 / 신상품 아이콘 노출 여부

추천, 품절, 신상품 아이콘을 목록에서 표시하는지 여부  
  
※ 품절 아이콘  
  
● 상품이 품절 상태임을 알려주는 아이콘  
● 재고관리 및 품절 기능을 사용하는 상품에 대해 재고가 없을 경우 표시  
  
※ 추천, 신상품 아이콘  
  
● 상품분류나 메인화면의 추천상품, 신상품 영역에 진열된 상품인 경우, 설정에 따라 해당 아이콘을 표시함  
  
※ 아이콘 노출 여부 설정위치 : \[쇼핑몰 설정 > 상품 설정 > '상품 정책 설정 > 상품 관련 설정 > 상품 아이콘 설정'\]

 |
| sold\_out | 

품절여부

T : 품절  
F : 품절아님

 |
| discountprice | 

상품 할인판매가 리소스

 |
| decorationimages | 

꾸미기 이미지 리소스

 |
| benefits | 

혜택 리소스

 |
| additionalimages  

_배열 최대사이즈: \[20\]_

 | 

추가 이미지 리소스

 |
| exposure\_limit\_type | 

표시제한 범위

A : 모두에게 표시  
M : 회원에게만 표시

 |
| exposure\_group\_list | 

표시대상 회원 등급

 |
| cultural\_tax\_deduction | 

문화비 소득공제

 |
| bundle\_product\_sales | 

세트할인 정보

 |
| category | 

분류 번호

해당 상품이 진열되어있는 상품 분류.

 |
| project\_no | 

기획전 번호

 |
| description | 

상품상세설명

상품에 보다 상세한 정보가 포함되어있는 설명. HTML을 사용하여 입력이 가능하다.

 |
| mobile\_description | 

모바일 상품 상세설명

입력시 모바일 쇼핑몰에서 상품상세설명 대신 모바일 상품 상세 설명을 대신 표시함.

 |
| separated\_mobile\_description | 

모바일 별도 등록

T : 직접등록  
F : 상품 상세설명 동일

 |
| additional\_image  

_배열 최대사이즈: \[20\]_

 | 

추가이미지

상품 상세 화면 하단에 표시되는 상품의 추가 이미지. 축소 이미지와 비슷한 위치에 표시되며 PC 쇼핑몰에서는 마우스 오버시, 모바일 쇼핑몰에서는 이미지 스와이프(Swipe)시 추가 이미지를 확인할 수 있다.  
  
특정 상품 상세 조회 API에서만 확인 가능하다.

 |
| payment\_info | 

상품결제안내

상품의 결제 방법에 대한 안내 문구. HTML을 사용하여 입력이 가능하다.

 |
| shipping\_info | 

상품배송안내

상품의 배송 방법에 대한 안내 문구. HTML을 사용하여 입력이 가능하다.

 |
| exchange\_info | 

교환/반품안내

상품의 교환/반품 방법에 대한 안내 문구. HTML을 사용하여 입력이 가능하다.

 |
| service\_info | 

서비스문의/안내

제품의 사후 고객 서비스 방법 대한 안내 문구. HTML을 사용하여 입력이 가능하다.

 |
| country\_hscode | 

국가별 HS 코드

해외 배송시 관세 부과를 위해 사용하는 HS코드. 국제 배송시 통관을 위해 반드시 정확한 번호를 입력해야 함.  
  
국가별로 HS 코드의 표준이 다르기 때문에 해당 국가에 맞는 코드 입력이 필요함.

 |
| simple\_description | 

상품 간략 설명

상품에 대한 간략한 정보. 상품 진열 화면에서 노출 가능한 설명. HTML을 사용하여 입력이 가능하다.  
\[쇼핑몰 설정 > 상품 설정 > '상품 보기 설정 > 상품 정보 표시 설정'\]에서 노출되도록 설정 가능하다.

 |
| shipping\_calculation | 

배송 계산 유형

A : 자동 계산  
M : 수동 계산

 |
| shipping\_fee\_by\_product | 

개별배송여부

상품에 배송비를 개별적으로 부과할 것인지 공통 배송비를 부과할 것인지에 대한 설정.  
개별 배송비를 사용하지 않을 경우 공통 배송비를 사용함.  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.

T : 사용함  
F : 사용안함

 |
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

 |
| prepaid\_shipping\_fee | 

배송비 선결제 설정

shipping\_calculation이 A(자동계산)일 경우 null로 반환.

C : 착불  
P : 선결제  
B : 선결제/착불

 |
| shipping\_period | 

배송기간

(개별배송비를 사용할 경우) 상품 배송시 평균적으로 소요되는 배송 기간.  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.

 |
| shipping\_scope | 

배송정보

국내에만 배송이 가능한 상품인지 해외에도 배송이 가능한 상품인지 표시.  
\[쇼핑몰 설정 > 배송 설정 > '배송 정책 설정 > 배송비 설정 > 개별배송비 설정'\] 에서 상품별 개별 배송료 설정이 사용안함인 경우 설정 불가.  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.

A : 국내배송  
C : 해외배송  
B : 국내/해외배송

 |
| shipping\_area  

_최대글자수 : \[255자\]_

 | 

배송지역

(개별배송비를 사용할 경우) 상품을 배송할 수 있는 지역.  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.

 |
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

 |
| shipping\_rates | 

구간별 배송비

개별배송비를 사용할 경우 상품의 개별 배송비.  
  
shipping\_fee\_type이 R, N일 경우 배열 안에 shipping\_fee를 정의하여 배송비를 설정할 수 있다.  
  
shipping\_fee\_type이 M, D, W, C일 경우 배열 안에 다음과 같이 정의하여 배송비 구간을 설정할 수 있다.  
shipping\_rates\_min : 배송비 구간 시작 기준  
shipping\_rates\_max : 배송비 구간 종료 기준  
shipping\_fee : 배송비  
  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.

 |
| clearance\_category\_eng | 

해외통관용 상품구분 영문명

해외 통관시 통관용 상품 구분 정보로 사용하는 정보. 국문명 입력시 입력한 구분명이 자동으로 번역된 항목.  
  
번역된 영문명이 해외송장 상품명에 포함되어 전송됨.

 |
| clearance\_category\_kor | 

해외통관용 상품구분 국문명

해외 통관시 통관용 상품 구분 정보로 사용하는 정보. 자동으로 영문으로 번역되어 해외송장 상품명 정보에 포함하여 전송.

 |
| clearance\_category\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

해외통관코드

 |
| additional\_information | 

추가항목

\[쇼핑몰 설정 > 상품 설정 > '상품 보기 설정 > 상품 정보 표시 설정'\]에서 추가한 추가항목.  
  
기본적인 상품 정보 외에 추가로 표시항 항목이 있을 때 추가하여 사용함.

 |
| image\_upload\_type | 

이미지 업로드 타입

이미지 업로드시 이미지 업로드 타입.  
"대표이미지 등록"시 상세이미지를 리사이징하여 목록이미지, 작은목록이미지, 축소이미지에 업로드  
"개별이미지 등록"시 상세이미지, 목록이미지, 작은목록이미지, 축소이미지를 각각 따로 업로드  
  
※ EC Global은 FTP를 지원하지 않으므로 C는 사용할 수 없음

A : 대표이미지등록  
B : 개별이미지등록  
C : 웹FTP 등록

 |
| main | 

메인진열

상품을 "추천상품", "신상품"과 같은 메인진열에 진열할 경우, 메인 진열 번호를 표시한다.

 |
| relational\_product  

_배열 최대사이즈: \[200\]_

 | 

관련상품

해당 상품과 비슷한 상품 혹은 대체 가능한 상품. 관련 상품 등록시 해당 상품의 상세페이지 하단에 노출된다.

 |
| memos | 

메모 리소스

 |
| hits | 

상품 조회수 리소스

 |
| seo | 

상품 Seo 리소스

 |
| tags | 

상품 태그 리소스

 |

### Retrieve a list of bundles [](#retrieve-a-list-of-bundles)cafe24 youtube

GET /api/v2/admin/bundleproducts

###### GET

세트상품을 목록을 통해 조회할 수 있습니다.  
상품코드, 자체상품 코드, 상품명 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| discountprice  
**embed** | 
상품 할인판매가 리소스

 |
| decorationimages  
**embed** | 

꾸미기 이미지 리소스

 |
| benefits  
**embed** | 

혜택 리소스

 |
| additionalimages  
**embed** | 

추가 이미지 리소스

 |
| shop\_no | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| product\_no | 

상품번호

조회하고자 하는 상품의 번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| display | 

진열상태

T : 진열함  
F : 진열안함

 |
| selling | 

판매상태

T : 판매함  
F : 판매안함

 |
| product\_code | 

상품코드

,(콤마)로 여러 건을 검색할 수 있다.

 |
| product\_tag | 

상품 검색어

,(콤마)로 여러 건을 검색할 수 있다.

 |
| custom\_product\_code | 

자체상품 코드

,(콤마)로 여러 건을 검색할 수 있다.

 |
| product\_name | 

상품명

,(콤마)로 여러 건을 검색할 수 있다.

 |
| eng\_product\_name | 

영문 상품명

,(콤마)로 여러 건을 검색할 수 있다.

 |
| supply\_product\_name | 

공급사 상품명

,(콤마)로 여러 건을 검색할 수 있다.

 |
| internal\_product\_name | 

상품명(관리용)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| model\_name | 

모델명

,(콤마)로 여러 건을 검색할 수 있다.

 |
| price\_min | 

상품 판매가 검색 최소값

 |
| price\_max | 

상품 판매가 검색 최대값

 |
| created\_start\_date | 

상품 등록일 검색 시작일

 |
| created\_end\_date | 

상품 등록일 검색 종료일

 |
| updated\_start\_date | 

상품 수정일 검색 시작일

 |
| updated\_end\_date | 

상품 수정일 검색 종료일

 |
| category | 

분류 번호

 |
| category\_unapplied | 

미적용 분류 검색

T: 미적용 분류 검색

 |
| include\_sub\_category | 

하위분류 포함 검색

T: 포함

 |
| product\_weight | 

상품 중량

 |
| additional\_information\_key | 

추가항목 검색조건 키

 |
| additional\_information\_value | 

추가항목 검색조건 값

 |
| sort | 

정렬 순서 값

created\_date : 등록일  
updated\_date : 수정일  
product\_name : 상품명

 |
| order | 

정렬 순서

asc : 순차정렬  
desc : 역순 정렬

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

 |

Retrieve a list of bundles

*   [Retrieve a list of bundles](#none)
*   [Retrieve bundleproducts with fields parameter](#none)
*   [Retrieve bundleproducts with embed parameter](#none)
*   [Retrieve a specific bundleproducts with product\_no parameter](#none)
*   [Retrieve bundleproducts using paging](#none)
*   [Retrieve multiple bundleproducts](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a bundle [](#retrieve-a-bundle)cafe24 youtube

GET /api/v2/admin/bundleproducts/{product\_no}

###### GET

특정 세트상품을 상세조회할 수 있습니다.  
세트할인 정보와 같은 상세 정보를 추가로 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

조회하고자 하는 상품의 번호

 |
| discountprice  
**embed** | 

상품 할인판매가 리소스

 |
| decorationimages  
**embed** | 

꾸미기 이미지 리소스

 |
| benefits  
**embed** | 

혜택 리소스

 |
| memos  
**embed** | 

메모 리소스

 |
| hits  
**embed** | 

상품 조회수 리소스

 |
| seo  
**embed** | 

상품 Seo 리소스

 |
| tags  
**embed** | 

상품 태그 리소스

 |
| additionalimages  
**embed** | 

추가 이미지 리소스

 |

Retrieve a bundle

*   [Retrieve a bundle](#none)
*   [Retrieve a bundleproduct with fields parameter](#none)
*   [Retrieve a bundleproduct with embed](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a bundle [](#create-a-bundle)cafe24 youtube

POST /api/v2/admin/bundleproducts

###### POST

세트상품을 생성할 수 있습니다.  
구성상품을 묶은 가격에 대해 추가로 세트상품 할인을 적용할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_name**  
**Required**  

_최대글자수 : \[250자\]_

 | 

상품명

 |
| **bundle\_product\_components**  
**Required** | 

세트상품의 구성상품 정보

 |
| 

bundle\_product\_components 하위 요소 보기

**product\_no**  
**Required**  
세트상품의 구성상품 번호

**purchase\_quantity**  
**Required**  
세트상품 구매개수







 |
| **bundle\_product\_sales**  
**Required** | 

세트할인 정보

 |
| 

bundle\_product\_sales 하위 요소 보기

**discount\_value**  
**Required**  
세트상품 할인가

**discount\_type**  
**Required**  
세트상품 할인타입  
P : 퍼센트  
V : 정액

**discount\_round\_unit**  
세트상품 할인 절사 단위  
F : 절사안함  
\-2 : 0.01단위  
\-1 : 0.1단위  
0 : 1단위  
1 : 10단위  
2 : 100단위  
3 : 1000단위

**discount\_round\_type**  
세트상품 할인 절사 방식  
F : 내림  
R : 반올림  
C : 올림







 |
| display | 

진열상태

**Youtube shopping 이용 시에는 미제공**

T : 진열함  
F : 진열안함

DEFAULT F

 |
| add\_category\_no | 

추가 분류 번호

**Youtube shopping 이용 시에는 미제공**

분류 번호를 사용하여 진열을 원하는 카테고리에 상품 등록

 |
| 

add\_category\_no 하위 요소 보기

**category\_no**  
**Required**  
분류 번호

**recommend**  
추천상품 분류 등록 여부  
T : 추천상품 등록  
F : 추천상품 등록안함  
DEFAULT F

**new**  
신상품 분류 등록 여부  
T : 신상품 등록  
F : 신상품 등록안함  
DEFAULT F







 |
| custom\_product\_code  

_최대글자수 : \[40자\]_

 | 

자체상품 코드

사용자가 상품에 부여 가능한 코드. 재고 관리등의 이유로 자체적으로 상품을 관리 하고 있는 경우 사용함.

 |
| eng\_product\_name  

_최대글자수 : \[250자\]_

 | 

영문 상품명

**Youtube shopping 이용 시에는 미제공**

 |
| supply\_product\_name  

_최대글자수 : \[250자\]_

 | 

공급사 상품명

 |
| internal\_product\_name  

_최대글자수 : \[50자\]_

 | 

상품명(관리용)

**Youtube shopping 이용 시에는 미제공**

 |
| model\_name  

_최대글자수 : \[100자\]_

 | 

모델명

**Youtube shopping 이용 시에는 미제공**

 |
| use\_naverpay | 

네이버페이 사용여부

**Youtube shopping 이용 시에는 미제공**

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

T : 사용함  
F : 사용안함

 |
| naverpay\_type | 

네이버페이 판매타입

**Youtube shopping 이용 시에는 미제공**

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

C : 네이버페이 + 쇼핑몰 동시판매 상품  
O : 네이버페이 전��상품

 |
| product\_weight  

_최소: \[0\]~최대: \[999999.99\]_

 | 

상품 중량

 |
| description | 

상품상세설명

 |
| mobile\_description | 

모바일 상품 상세설명

입력시 모바일 쇼핑몰에서 상품상세설명 대신 모바일 상품 상세 설명을 대신 표시함.

 |
| summary\_description  

_최대글자수 : \[255자\]_

 | 

상품요약설명

 |
| simple\_description | 

상품 간략 설명

**Youtube shopping 이용 시에는 미제공**

 |
| product\_tag  

_배열 최대사이즈: \[100\]_

 | 

상품 검색어

**Youtube shopping 이용 시에는 미제공**

쇼핑 큐레이션 사용 시 - 배열 최대사이즈 : \[100\]

 |
| payment\_info | 

상품결제안내

 |
| shipping\_info | 

상품배송안내

 |
| exchange\_info | 

교환/반품안내

 |
| service\_info | 

서비스문의/안내

 |
| icon  

_배열 최대사이즈: \[5\]_

 | 

아이콘

**Youtube shopping 이용 시에는 미제공**

 |
| hscode  

_최대글자수 : \[20자\]_

 | 

HS코드

배송정보(shipping\_scope)가 C(해외배송)일 경우 필수 입력  
shipping\_calculation이 A(자동계산)일 경우 필수 입력 아님

 |
| shipping\_scope | 

배송정보

국내에만 배송이 가능한 상품인지 해외에도 배송이 가능한 상품인지 표시.  
\[쇼핑몰 설정 > 배송 설정 > '배송 정책 설정 > 배송비 설정 > 개별배송비 설정'\] 에서 상품별 개별 배송료 설정이 사용안함인 경우 설정 불가.  
  
※ 쇼핑몰이 EC Global 쇼핑몰일 경우 "C"를 필수로 입력해야한다.

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

A : 국내배송  
C : 해외배송  
B : 국내/해외배송

DEFAULT A

 |
| shipping\_method | 

배송방법

01 : 택배  
02 : 빠른등기  
03 : 일반등기  
04 : 직접배송  
05 : 퀵배송  
06 : 기타  
07 : 화물배송  
08 : 매장직접수령  
09 : 배송필요 없음

DEFAULT 01

 |
| shipping\_fee\_by\_product | 

개별배송여부

T : 개별배송  
F : 기본배송

DEFAULT F

 |
| shipping\_area  

_최대글자수 : \[255자\]_

 | 

배송지역

 |
| shipping\_period  

_배열 최대사이즈: \[2\]_

 | 

배송기간

 |
| 

shipping\_period 하위 요소 보기

**minimum**  
최소 기간  
DEFAULT 1

**maximum**  
최대 기간  
DEFAULT 7







 |
| shipping\_fee\_type | 

배송비 타입

개별배송비를 사용할 경우 상품의 배송비 타입.

T : 배송비 무료  
R : 고정배송비 사용  
M : 구매 금액에 따른 부과  
D : 구매 금액별 차등 배송료 사용  
W : 상품 무게별 차등 배송료 사용  
C : 상품 수량별 차등 배송료 사용  
N : 상품 수량에 비례하여 배송료 부과

DEFAULT T

 |
| shipping\_rates  

_배열 최대사이즈: \[200\]_

 | 

배송비 금액

개별배송비를 사용할 경우 상품의 개별 배송비.  
  
shipping\_fee\_type이 R, N일 경우 배열 안에 shipping\_fee를 정의하여 배송비를 설정할 수 있다.  
  
shipping\_fee\_type이 M, D, W, C일 경우 배열 안에 다음과 같이 정의하여 배송비 구간을 설정할 수 있다.  
shipping\_rates\_min : 배송비 구간 시작 기준  
shipping\_rates\_max : 배송비 구간 종료 기준  
shipping\_fee : 배송비

 |
| prepaid\_shipping\_fee | 

배송비 선결제 설정

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

C : 착불  
P : 선결제  
B : 선결제/착불

DEFAULT B

 |
| clearance\_category\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

해외통관코드

배송정보(shipping\_scope)가 C(해외배송)일 경우 필수 입력  
shipping\_calculation이 A(자동계산)일 경우 필수 입력 아님  
[clearance\_category\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/clearance_category_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| detail\_image | 

상세이미지

 |
| list\_image | 

목록이미지

**Youtube shopping 이용 시에는 미제공**

 |
| tiny\_image | 

작은목록이미지

**Youtube shopping 이용 시에는 미제공**

 |
| small\_image | 

축소이미지

**Youtube shopping 이용 시에는 미제공**

 |
| image\_upload\_type | 

이미지 업로드 타입

**Youtube shopping 이용 시에는 미제공**

이미지 업로드시 이미지 업로드 타입.  
"대표이미지 등록"시 상세이미지를 리사이징하여 목록이미지, 작은목록이미지, 축소이미지에 업로드  
"개별이미지 등록"시 상세이미지, 목록이미지, 작은목록이미지, 축소이미지를 각각 따로 업로드  
  
※ EC Global은 FTP를 지원하지 않으므로 C는 사용할 수 없음

A : 대표이미지등록  
B : 개별이미지등록  
C : 웹FTP 등록

DEFAULT A

 |
| additional\_information | 

추가항목

**Youtube shopping 이용 시에는 미제공**

 |
| 

additional\_information 하위 요소 보기

**key**  
**Required**  
추가항목 키

**value**  
추가항목 값







 |
| price\_content  

_최대글자수 : \[20자\]_

 | 

판매가 대체문구

**Youtube shopping 이용 시에는 미제공**

 |
| buy\_limit\_by\_product | 

구매제한 개별 설정여부

**Youtube shopping 이용 시에는 미제공**

T : 사용함  
F : 사용안함

DEFAULT F

 |
| buy\_limit\_type | 

구매제한

**Youtube shopping 이용 시에는 미제공**

N : 회원만 구매하며  
구매버튼 감추기  
M : 회원만 구매하며  
구매버튼 보이기  
F : 구매제한 안함  
O : 지정된 회원만 구매하며 구매버튼 감추기  
D : 지정된 회원만 구매하며 구매버튼 보이기

DEFAULT F

 |
| buy\_group\_list | 

구매가능 회원 등급

**Youtube shopping 이용 시에는 미제공**

 |
| buy\_member\_id\_list | 

구매가능 회원아이디

**Youtube shopping 이용 시에는 미제공**

 |
| repurchase\_restriction | 

재구매 제한

**Youtube shopping 이용 시에는 미제공**

T : 재구매 불가  
F : 제한안함

DEFAULT F

 |
| single\_purchase\_restriction | 

단독구매 제한

**Youtube shopping 이용 시에는 미제공**

단독구매 설정(single\_purchase)에 값을 입력했을 경우, single\_purchase 값이 우선 적용됨

T : 단독구매 불가  
F : 제한안함

DEFAULT F

 |
| single\_purchase | 

단독구매 설정

**Youtube shopping 이용 시에는 미제공**

T : 단독구매 불가  
F : 제한안함  
O : 단독구매 전용

 |
| points\_by\_product | 

적립금 개별설정 사용여부

**Youtube shopping 이용 시에는 미제공**

F : 기본설정 사용  
T : 개별설정

DEFAULT F

 |
| points\_setting\_by\_payment | 

결제방식별 적립금 설정 여부

**Youtube shopping 이용 시에는 미제공**

B : 기본 적립금설정 사용  
C : 결제방식에 따른 적립

 |
| points\_amount | 

적립금 설정 정보

**Youtube shopping 이용 시에는 미제공**

 |
| except\_member\_points | 

회원등급 추가 적립 제외

**Youtube shopping 이용 시에는 미제공**

T : 회원등급 추가 적립 제외 설정함  
F : 회원등급 추가 적립 제외 설정안함

DEFAULT F

 |
| main | 

메인진열

**Youtube shopping 이용 시에는 미제공**

상품을 "추천상품", "신상품"과 같은 메인진열에 진열할 경우, 메인 진열 번호를 표시한다.

 |
| relational\_product  

_배열 최대사이즈: \[200\]_

 | 

관련상품

**Youtube shopping 이용 시에는 미제공**

해당 상품과 비슷한 상품 혹은 대체 가능한 상품. 관련 상품 등록시 해당 상품의 상세페이지 하단에 노출된다.

 |
| 

relational\_product 하위 요소 보기

**product\_no**  
**Required**  
상품번호

**interrelated**  
**Required**  
관련상품 상호등록 여부  
T : 상호등록  
F : 일방등록







 |
| product\_material | 

상품소재

**Youtube shopping 이용 시에는 미제공**

상품의 소재. 복합 소재일 경우 상품의 소재와 함유랑을 함께 입력해야함. (예 : 면 80%, 레이온 20%)

 |
| english\_product\_material | 

영문 상품 소재

**Youtube shopping 이용 시에는 미제공**

상품의 소재의 영어 표기. 해외 배송사를 이용할 경우 의류의 소재를 통관시 요구하는 경우가 있음.

 |
| cloth\_fabric | 

옷감

**Youtube shopping 이용 시에는 미제공**

상품이 의류인 경우, 옷감. 일본 택배사를 이용할 경우, 택배사에 따라 의류 통관시 옷감 정보를 입력 받는 경우가 있음.

woven : 직물(woven)  
knit : 편물(knit)

 |
| additional\_image | 

추가이미지

상품 상세 화면 하단에 표시되는 상품의 추가 이미지. 축소 이미지와 비슷한 위치에 표시되며 PC 쇼핑몰에서는 마우스 오버시, 모바일 쇼핑몰에서는 이미지 스와이프(Swipe)시 추가 이미지를 확인할 수 있다.  
  
추가이미지는 최대 20개까지 등록 가능하다.

 |
| adult\_certification | 

성인인증

성인인증이 필요한 상품인지 여부. 성인인증이 필요한 상품인 구매를 위해서는 본인인증을 거쳐야함.  
  
\[쇼핑몰 설정 > 고객 설정 > '회원 정책 설정 > 회원 관련 설정 > 회원가입 및 본인인증 설정'\] 에서 성인인증 사용 시 구매차단 설정이 사용함이어야 성인인증이 적용된다.

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

T : 사용함  
F : 사용안함

DEFAULT F

 |
| exposure\_limit\_type | 

표시제한 범위

**Youtube shopping 이용 시에는 미제공**

A : 모두에게 표시  
M : 회원에게만 표시

DEFAULT A

 |
| exposure\_group\_list | 

표시대상 회원 등급

**Youtube shopping 이용 시에는 미제공**

 |

Create a bundle

*   [Create a bundle](#none)
*   [Create a bundleproduct using only product\_name, bundle\_product\_components, and bundle\_product\_sales fields](#none)
*   [Try creating a bundleproduct without product\_name field](#none)
*   [Try creating a bundleproduct without bundle\_product\_components field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a bundle [](#update-a-bundle)cafe24 youtube

PUT /api/v2/admin/bundleproducts/{product\_no}

###### PUT

특정 세트상품의 정보를 수정할 수 있습니다.  
상품명, 세트상품의 구성상품 정보, 세트할인 정보 등을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| product\_name  

_최대글자수 : \[250자\]_

 | 

상품명

 |
| bundle\_product\_components | 

세트상품의 구성상품 정보

 |
| 

bundle\_product\_components 하위 요소 보기

**product\_no**  
**Required**  
세트상품의 구성상품 번호

**purchase\_quantity**  
**Required**  
세트상품 구매개수







 |
| bundle\_product\_sales | 

세트할인 정보

 |
| 

bundle\_product\_sales 하위 요소 보기

**discount\_value**  
**Required**  
세트상품 할인가

**discount\_type**  
**Required**  
세트상품 할인타입  
P : 퍼센트  
V : 정액

**discount\_round\_unit**  
세트상품 할인 절사 단위  
F : 절사안함  
\-2 : 0.01단위  
\-1 : 0.1단위  
0 : 1단위  
1 : 10단위  
2 : 100단위  
3 : 1000단위

**discount\_round\_type**  
세트상품 할인 절사 방식  
F : 내림  
R : 반올림  
C : 올림







 |
| display | 

진열상태

**Youtube shopping 이용 시에는 미제공**

상품을 쇼핑몰에 진열할지 여부 변경.

T : 진열함  
F : 진열안함

 |
| product\_condition | 

상품 상태

N : 신상품  
B : 반품상품  
R : 재고상품  
U : 중고상품  
E : 전시상품  
F : 리퍼상품  
S : 스크래치 상품

 |
| product\_used\_month  

_최대값: \[2147483647\]_

 | 

중고상품 사용 개월

상품 상태(product\_condition)가 중고 상품일 경우 중고 상품의 사용 개월 수

 |
| add\_category\_no | 

추가 분류 번호

**Youtube shopping 이용 시에는 미제공**

상품분류 번호를 입력하여 해당 상품에 특정 상품분류를 추가 등록

 |
| 

add\_category\_no 하위 요소 보기

**category\_no**  
**Required**  
분류 번호

**recommend**  
추천상품 분류 등록 여부  
T : 추천상품 등록  
F : 추천상품 등록안함  
DEFAULT F

**new**  
신상품 분류 등록 여부  
T : 신상품 등록  
F : 신상품 등록안함  
DEFAULT F







 |
| delete\_category\_no | 

삭제 분류 번호

**Youtube shopping 이용 시에는 미제공**

상품분류 번호를 입력하여 해당 상품에 특정 상품분류 삭제

 |
| custom\_product\_code  

_최대글자수 : \[40자\]_

 | 

자체상품 코드

사용자가 상품에 부여 가능한 코드. 재고 관리등의 이유로 자체적으로 상품을 관리 하고 있는 경우 사용함.

 |
| eng\_product\_name  

_최대글자수 : \[250자\]_

 | 

영문 상품명

**Youtube shopping 이용 시에는 미제공**

 |
| supply\_product\_name  

_최대글자수 : \[250자\]_

 | 

공급사 상품명

 |
| internal\_product\_name  

_최대글자수 : \[50자\]_

 | 

상품명(관리용)

**Youtube shopping 이용 시에는 미제공**

 |
| model\_name  

_최대글자수 : \[100자\]_

 | 

모델명

**Youtube shopping 이용 시에는 미제공**

 |
| use\_naverpay | 

네이버페이 사용여부

**Youtube shopping 이용 시에는 미제공**

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

T : 사용함  
F : 사용안함

 |
| naverpay\_type | 

네이버페이 판매타입

**Youtube shopping 이용 시에는 미제공**

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

C : 네이버페이 + 쇼핑몰 동시판매 상품  
O : 네이버페이 전용상품

 |
| product\_weight  

_최소: \[0\]~최대: \[999999.99\]_

 | 

상품 중량

 |
| description | 

상품상세설명

 |
| mobile\_description | 

모바일 상품 상세설명

입력시 모바일 쇼핑몰에서 상품상세설명 대신 모바일 상품 상세 설명을 대신 표시함.

 |
| summary\_description  

_최대글자수 : \[255자\]_

 | 

상품요약설명

 |
| simple\_description | 

상품 간략 설명

**Youtube shopping 이용 시에는 미제공**

 |
| product\_tag  

_배열 최대사이즈: \[100\]_

 | 

상품 검색어

**Youtube shopping 이용 시에는 미제공**

쇼핑 큐레이션 사용 시 - 배열 최대사이즈 : \[100\]

 |
| payment\_info | 

상품결제안내

 |
| shipping\_info | 

상품배송안내

 |
| exchange\_info | 

교환/반품안내

 |
| service\_info | 

서비스문의/안내

 |
| icon  

_배열 최대사이즈: \[5\]_

 | 

아이콘

**Youtube shopping 이용 시에는 미제공**

 |
| use\_icon\_exposure\_term | 

표시기간 사용 여부

**Youtube shopping 이용 시에는 미제공**

T : 사용함  
F : 사용안함

 |
| icon\_exposure\_begin\_datetime | 

표시기간 시작 일자

**Youtube shopping 이용 시에는 미제공**

 |
| icon\_exposure\_end\_datetime | 

표시기간 종료 일자

**Youtube shopping 이용 시에는 미제공**

 |
| hscode  

_최대글자수 : \[20자\]_

 | 

HS코드

배송정보(shipping\_scope)가 C(해외배송)일 경우 필수 입력  
shipping\_calculation이 A(자동계산)일 경우 필수 입력 아님

 |
| shipping\_scope | 

배송정보

국내에만 배송이 가능한 상품인지 해외에도 배송이 가능한 상품인지 표시. \[쇼핑몰 설정 > 배송 설정 > '배송 정책 설정 > 배송비 설정 > 개별배송비 설정'\] 에서 상품별 개별배송료 설정이 사용안함인 경우 설정 불가.

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

A : 국내배송  
C : 해외배송  
B : 국내/해외배송

 |
| prepaid\_shipping\_fee | 

배송비 선결제 설정

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

C : 착불  
P : 선결제  
B : 선결제/착불

 |
| shipping\_method | 

배송방법

01 : 택배  
02 : 빠른등기  
03 : 일반등기  
04 : 직접배송  
05 : 퀵배송  
06 : 기타  
07 : 화물배송  
08 : 매장직접수령  
09 : 배송필요 없음

 |
| shipping\_fee\_by\_product | 

개별배송여부

T : 개별배송  
F : 기본배송

 |
| shipping\_area  

_최대글자수 : \[255자\]_

 | 

배송지역

 |
| shipping\_period  

_배열 최대사이즈: \[2\]_

 | 

배송기간

 |
| 

shipping\_period 하위 요소 보기

**minimum**  
최소 기간  
DEFAULT 1

**maximum**  
최대 기간  
DEFAULT 7







 |
| shipping\_fee\_type | 

배송비 타입

개별배송비를 사용할 경우 상품의 배송비 타입.

T : 배송비 무료  
R : 고정배송비 사용  
M : 구매 금액에 따른 부과  
D : 구매 금액별 차등 배송료 사용  
W : 상품 무게별 차등 배송료 사용  
C : 상품 수량별 차등 배송료 사용  
N : 상품 수량에 비례하여 배송료 부과

 |
| shipping\_rates | 

배송비 금액

개별배송비를 사용할 경우 상품의 개별 배송비.  
  
shipping\_fee\_type이 R, N일 경우 배열 안에 shipping\_fee를 정의하여 배송비를 설정할 수 있다.  
  
shipping\_fee\_type이 M, D, W, C일 경우 배열 안에 다음과 같이 정의하여 배송비 구간을 설정할 수 있다.  
shipping\_rates\_min : 배송비 구간 시작 기준  
shipping\_rates\_max : 배송비 구간 종료 기준  
shipping\_fee : 배송비

 |
| clearance\_category\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

해외통관코드

배송정보(shipping\_scope)가 C(해외배송)일 경우 필수 입력  
shipping\_calculation이 A(자동계산)일 경우 필수 입력 아님  
[clearance\_category\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/clearance_category_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| detail\_image | 

상세이미지

 |
| list\_image | 

목록이미지

**Youtube shopping 이용 시에는 미제공**

 |
| tiny\_image | 

작은목록이미지

**Youtube shopping 이용 시에는 미제공**

 |
| small\_image | 

축소이미지

**Youtube shopping 이용 시에는 미제공**

 |
| image\_upload\_type | 

이미지 업로드 타입

**Youtube shopping 이용 시에는 미제공**

이미지 업로드시 이미지 업로드 타입.  
"대표이미지 등록"시 상세이미지를 리사이징하여 목록이미지, 작은목록이미지, 축소이미지에 업로드  
"개별이미지 등록"시 상세이미지, 목록이미지, 작은목록이미지, 축소이미지를 각각 따로 업로드  
  
※ EC Global은 FTP를 지원하지 않으므로 C는 사용할 수 없음

A : 대표이미지등록  
B : 개별이미지등록  
C : 웹FTP 등록

 |
| additional\_information | 

추가항목

**Youtube shopping 이용 시에는 미제공**

 |
| 

additional\_information 하위 요소 보기

**key**  
**Required**  
추가항목 키

**value**  
추가항목 값







 |
| price\_content  

_최대글자수 : \[20자\]_

 | 

판매가 대체문구

**Youtube shopping 이용 시에는 미제공**

 |
| buy\_limit\_by\_product | 

구매제한 개별 설정여부

**Youtube shopping 이용 시에는 미제공**

T : 사용함  
F : 사용안함

 |
| buy\_limit\_type | 

구매제한

**Youtube shopping 이용 시에는 미제공**

N : 회원만 구매하며  
구매버튼 감추기  
M : 회원만 구매하며  
구매버튼 보이기  
F : 구매제한 안함  
O : 지정된 회원만 구매하며 구매버튼 감추기  
D : 지정된 회원만 구매하며 구매버튼 보이기

 |
| buy\_group\_list | 

구매가능 회원 등급

**Youtube shopping 이용 시에는 미제공**

 |
| buy\_member\_id\_list | 

구매가능 회원아이디

**Youtube shopping 이용 시에는 미제공**

 |
| repurchase\_restriction | 

재구매 제한

**Youtube shopping 이용 시에는 미제공**

T : 재구매 불가  
F : 제한안함

 |
| single\_purchase\_restriction | 

단독구매 제한

**Youtube shopping 이용 시에는 미제공**

단독구매 설정(single\_purchase)에 값을 입력했을 경우, single\_purchase 값이 우선 적용됨

T : 단독구매 불가  
F : 제한안함

 |
| single\_purchase | 

단독구매 설정

**Youtube shopping 이용 시에는 미제공**

T : 단독구매 불가  
F : 제한안함  
O : 단독구매 전용

 |
| points\_by\_product | 

적립금 개별설정 사용여부

**Youtube shopping 이용 시에는 미제공**

F : 기본설정 사용  
T : 개별설정

 |
| points\_setting\_by\_payment | 

결제방식별 적립금 설정 여부

**Youtube shopping 이용 시에는 미제공**

B : 기본 적립금설정 사용  
C : 결제방식에 따른 적립

 |
| points\_amount | 

적립금 설정 정보

**Youtube shopping 이용 시에는 미제공**

 |
| except\_member\_points | 

회원등급 추가 적립 제외

**Youtube shopping 이용 시에는 미제공**

T : 회원등급 추가 적립 제외 설정함  
F : 회원등급 추가 적립 제외 설정안함

 |
| main | 

메인진열

**Youtube shopping 이용 시에는 미제공**

상품을 "추천상품", "신상품"과 같은 메인진열에 진열할 경우, 메인 진열 번호를 표시한다.

 |
| relational\_product  

_배열 최대사이즈: \[200\]_

 | 

관련상품

**Youtube shopping 이용 시에는 미제공**

해당 상품과 비슷한 상품 혹은 대체 가능한 상품. 관련 상품 등록시 해당 상품의 상세페이지 하단에 노출된다.

 |
| 

relational\_product 하위 요소 보기

**product\_no**  
상품번호

**interrelated**  
**Required**  
관련상품 상호등록 여부  
T : 상호등록  
F : 일방등록







 |
| product\_material | 

상품소재

**Youtube shopping 이용 시에는 미제공**

상품의 소재. 복합 소재일 경우 상품의 소재와 함유랑을 함께 입력해야함. (예 : 면 80%, 레이온 20%)

 |
| english\_product\_material | 

영문 상품 소재

**Youtube shopping 이용 시에는 미제공**

상품의 소재의 영어 표기. 해외 배송사를 이용할 경우 의류의 소재를 통관시 요구하는 경우가 있음.

 |
| cloth\_fabric | 

옷감

**Youtube shopping 이용 시에는 미제공**

상품이 의류인 경우, 옷감. 일본 택배사를 이용할 경우, 택배사에 따라 의류 통관시 옷감 정보를 입력 받는 경우가 있음.

woven : 직물(woven)  
knit : 편물(knit)

 |
| additional\_image | 

추가이미지

상품 상세 화면 하단에 표시되는 상품의 추가 이미지. 축소 이미지와 비슷한 위치에 표시되며 PC 쇼핑몰에서는 마우스 오버시, 모바일 쇼핑몰에서는 이미지 스와이프(Swipe)시 추가 이미지를 확인할 수 있다.  
  
추가이미지는 최대 20개까지 등록 가능하다.

 |
| adult\_certification | 

성인인증

성인인증이 필요한 상품인지 여부. 성인인증이 필요한 상품인 구매를 위해서는 본인인증을 거쳐야함.  
  
\[쇼핑몰 설정 > 고객 설정 > '회원 정책 설정 > 회원 관련 설정 > 회원가입 및 본인인증 설정'\] 에서 성인인증 사용 시 구매차단 설정이 사용함이어야 성인인증이 적용된다.

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

T : 사용함  
F : 사용안함

 |
| exposure\_limit\_type | 

표시제한 범위

**Youtube shopping 이용 시에는 미제공**

A : 모두에게 표시  
M : 회원에게만 표시

 |
| exposure\_group\_list | 

표시대상 회원 등급

**Youtube shopping 이용 시에는 미제공**

 |

Update a bundle

*   [Update a bundle](#none)
*   [Update component products of the bundle product](#none)
*   [Update bundle discount information of bundle product](#none)
*   [Update the bundle product status to hidden](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a bundle [](#delete-a-bundle)cafe24 youtube

DELETE /api/v2/admin/bundleproducts/{product\_no}

###### DELETE

특정 세트상품을 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |

Delete a bundle

*   [Delete a bundle](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Categories products

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Categories%20products.png)  
  
카테고리 상품(Categories products)은 카테고리의 상품의 표시 순서, 고정 여부, 진열 영역 등을 조회, 수정할 수 있는 관계형 리소스입니다.

> Endpoints

```
GET /api/v2/admin/categories/{category_no}/products
GET /api/v2/admin/categories/{category_no}/products/count
POST /api/v2/admin/categories/{category_no}/products
PUT /api/v2/admin/categories/{category_no}/products
DELETE /api/v2/admin/categories/{category_no}/products/{product_no}
```

#### \[더보기 상세 내용\]

### Categories products property list[](#categories__products-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| product\_no | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| sequence\_no | 

표시 순서

 |
| auto\_sort | 

자동 정렬 여부

 |
| sold\_out | 

품절여부

 |
| fixed\_sort | 

고정 여부

 |
| not\_for\_sale | 

판매안함 여부

 |
| display\_group  

_최소: \[1\]~최대: \[3\]_

 | 

상세 상품분류

1 : 일반상품  
2 : 추천상품  
3 : 신상품

DEFAULT 1

 |
| sequence  

_최소: \[1\]~최대: \[999998\]_

 | 

진열 순서

 |

### Retrieve a list of products by category [](#retrieve-a-list-of-products-by-category)cafe24 youtube

GET /api/v2/admin/categories/{category\_no}/products

###### GET

특정 카테고리에 배정된 상품을 목록으로 조회할 수 있습니다.  
상품은 동시에 여러 카테고리에 배정될 수 있습니다.  
상품번호, 표시 순서, 판매 여부 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **category\_no**  
**Required** | 

분류 번호

 |
| **display\_group**  
**Required**  

_최소: \[1\]~최대: \[3\]_

 | 

상세 상품분류

1 : 일반상품  
2 : 추천상품  
3 : 신상품

 |
| limit  

_최소: \[1\]~최대: \[50000\]_

 | 

조회결과 최대건수

DEFAULT 50000

 |

Retrieve a list of products by category

*   [Retrieve a list of products by category](#none)
*   [Retrieve mobile disaplayed products of the category](#none)
*   [Retrieve products of the category using limit parameter](#none)
*   [Retrieve product\_no and product name of products using fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of products by category [](#retrieve-a-count-of-products-by-category)cafe24 youtube

GET /api/v2/admin/categories/{category\_no}/products/count

###### GET

특정 카테고리에 배정된 상품의 수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **category\_no**  
**Required** | 

분류 번호

 |
| **display\_group**  
**Required**  

_최소: \[1\]~최대: \[3\]_

 | 

상세 상품분류

1 : 일반상품  
2 : 추천상품  
3 : 신상품

 |

Retrieve a count of products by category

*   [Retrieve a count of products by category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Add products to a category [](#add-products-to-a-category)cafe24 youtube

POST /api/v2/admin/categories/{category\_no}/products

###### POST

특정 카테고리에 상품을 배정할 수 있습니다.  
상품은 동시에 여러 카테고리에 배정될 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **category\_no**  
**Required** | 
분류 번호

 |
| display\_group  

_최소: \[1\]~최대: \[3\]_

 | 

상세 상품분류

1 : 일반상품  
2 : 추천상품  
3 : 신상품

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |

Add products to a category

*   [Add products to a category](#none)
*   [Post a product in the category](#none)
*   [Try posting a product in the category without product\_no](#none)
*   [Add products to a certain category by using only required fields](#none)
*   [Try adding products to a certain category by without product\_no field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a product in product category [](#update-a-product-in-product-category)cafe24 youtube

PUT /api/v2/admin/categories/{category\_no}/products

###### PUT

특정 카테고리에 배정된 상품을 수정할 수 있습니다.  
상품 자체를 수정하는 것은 아니며 정렬과 고정 등에 대한 설정값을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **category\_no**  
**Required** | 

분류 번호

 |
| **display\_group**  
**Required**  

_최소: \[1\]~최대: \[3\]_

 | 

상세 상품분류

1 : 일반상품  
2 : 추천상품  
3 : 신상품

 |
| **product\_no**  
**Required** | 

상품번호

 |
| sequence  

_최소: \[1\]~최대: \[999999\]_

 | 

진열 순서

 |
| auto\_sort | 

자동 정렬 여부

T : 자동 정렬 사용함  
F : 자동 정렬 사용안함

 |
| fixed\_sort | 

고정 여부

T : 진열순위 고정 사용함  
F : 진열순위 고정 사용안함

 |

Update a product in product category

*   [Update a product in product category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a product by category [](#delete-a-product-by-category)cafe24 youtube

DELETE /api/v2/admin/categories/{category\_no}/products/{product\_no}

###### DELETE

특정 카테고리에 배정된 상품을 삭제할 수 있습니다.  
해당 상품은 카테고리에서만 삭제될 뿐이고 실제로 상품 자체가 삭제되는것은 아닙니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **category\_no**  
**Required** | 
분류 번호

 |
| **product\_no**  
**Required** | 

상품번호

 |
| display\_group  

_최소: \[1\]~최대: \[3\]_

 | 

상세 상품분류

일반상품 영역에서 진열안함 처리 시, 추천상품/신상품 영역에서도 동시에 진열안함 처리된다.

1 : 일반상품  
2 : 추천상품  
3 : 신상품

DEFAULT 1

 |

Delete a product by category

*   [Delete a product by category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Categories properties

상품 목록 화면에 표시되는 항목을 조회하고 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/categories/properties
POST /api/v2/admin/categories/properties
PUT /api/v2/admin/categories/properties
```

#### \[더보기 상세 내용\]

### Categories properties property list[](#categories-properties-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| display\_group  

_최소: \[1\]~최대: \[3\]_

 | 

상세 상품분류

1 : 일반상품  
2 : 추천상품  
3 : 신상품

 |
| separated\_category | 

분류별 별도등록

T : 사용함  
F : 사용안함

 |
| category\_no | 

카테고리 번호

 |
| properties | 

항목 속성

 |
| property | 

항목 속성

 |

### Retrieve fields for products in the list [](#retrieve-fields-for-products-in-the-list)cafe24

GET /api/v2/admin/categories/properties

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| display\_group  

_최소: \[1\]~최대: \[3\]_

 | 

상세 상품분류

DEFAULT 1

 |
| separated\_category | 

분류별 별도등록

T : 사용함  
F : 사용안함

DEFAULT F

 |
| category\_no | 

카테고리 번호

 |

Retrieve fields for products in the list

*   [Retrieve fields for products in the list](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a field for product list page [](#create-a-field-for-product-list-page)cafe24

POST /api/v2/admin/categories/properties

###### POST

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| property | 
항목 속성

 |
| 

property 하위 요소 보기

**multishop\_display\_names** _Array_

multishop\_display\_names 하위 요소 보기

**shop\_no**  
멀티쇼핑몰 번호  
**Required**

**name**  
항목명 표시텍스트  
**Required**

**display**  
항목 표시여부  
DEFAULT F

**display\_name**  
항목명 표시설정  
T : 사용함  
F : 사용안함  
DEFAULT T

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)  
DEFAULT N

**font\_size**  
글자 크기  
DEFAULT 12

**font\_color**  
글자 색상  
DEFAULT #555555

**exposure\_group\_type**  
표시 대상 타입  
A: 전체  
M: 회원  
DEFAULT A







 |

Create a field for product list page

*   [Create a field for product list page](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update fields for products in the list [](#update-fields-for-products-in-the-list)cafe24

PUT /api/v2/admin/categories/properties

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **display\_group**  
**Required**  

_최소: \[1\]~최대: \[3\]_

 | 

상세 상품분류

1 : 일반상품  
2 : 추천상품  
3 : 신상품

 |
| separated\_category | 

분류별 별도등록

T : 사용함  
F : 사용안함

 |
| category\_no | 

카테고리 번호

 |
| properties | 

항목 속성

 |
| 

properties 하위 요소 보기

**key**  
**Required**  
항목코드

**name**  
항목명 표시텍스트

**display**  
항목 표시여부

**display\_name**  
항목명 표시설정  
T : 사용함  
F : 사용안함

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)

**font\_size**  
글자 크기

**font\_color**  
글자 색상







 |

Update fields for products in the list

*   [Update fields for products in the list](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Mains products

특정 메인분류에 배정된 상품을 목록으로 조회하거나 상품배정, 수정, 삭제할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/mains/{display_group}/products
GET /api/v2/admin/mains/{display_group}/products/count
POST /api/v2/admin/mains/{display_group}/products
PUT /api/v2/admin/mains/{display_group}/products
DELETE /api/v2/admin/mains/{display_group}/products/{product_no}
```

#### \[더보기 상세 내용\]

### Mains products property list[](#mains__products-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| product\_no | 

상품번호

 |
| product\_name | 

상품명

 |
| fixed\_sort | 

고정 여부

 |
| fix\_product\_no | 

진열순위 고정 상품번호

 |

### Retrieve a list of products in main category [](#retrieve-a-list-of-products-in-main-category)cafe24 youtube

GET /api/v2/admin/mains/{display\_group}/products

###### GET

특정 메인분류에 배정된 상품을 목록으로 조회할 수 있습니다.  
상품번호, 상품명, 고정 여부 등을 조회할 수 있습니다.  
상품은 동시에 여러 메인분류에 배정될 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **display\_group**  
**Required** | 

메인분류 번호

 |

Retrieve a list of products in main category

*   [Retrieve a list of products in main category](#none)
*   [Retrieve mobile disaplayed products of the main category](#none)
*   [Retrieve products of the main category using fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of products in main category [](#retrieve-a-count-of-products-in-main-category)cafe24 youtube

GET /api/v2/admin/mains/{display\_group}/products/count

###### GET

특정 메인분류에 배정된 상품의 수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **display\_group**  
**Required** | 

메인분류 번호

 |

Retrieve a count of products in main category

*   [Retrieve a count of products in main category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Set main category products [](#set-main-category-products)cafe24 youtube

POST /api/v2/admin/mains/{display\_group}/products

###### POST

특정 메인분류에 상품을 배정할 수 있습니다.  
상품은 동시에 여러 카테고리에 배정될 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| shop\_no | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **display\_group**  
**Required** | 

메인분류 번호

 |
| **product\_no**  
**Required** | 

상품번호

 |

Set main category products

*   [Set main category products](#none)
*   [Post a product in the mains category](#none)
*   [Try posting a product in the mains category without product\_no](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update fixed sorting of products in main category [](#update-fixed-sorting-of-products-in-main-category)cafe24 youtube

PUT /api/v2/admin/mains/{display\_group}/products

###### PUT

특정 메인분류에 배정된 상품을 수정할 수 있습니다.  
상품 자체를 수정하는 것은 아니며 진열순위의 고정 등에 대한 설정값을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| shop\_no | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **display\_group**  
**Required** | 

메인분류 번호

 |
| **product\_no**  
**Required** | 

상품번호

요청한 상품번호의 순서 대로 진열순위가 지정

 |
| fix\_product\_no | 

진열순위 고정 상품번호

진열순위를 고정하고자 하는 상품번호를 지정

 |

Update fixed sorting of products in main category

*   [Update fixed sorting of products in main category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a product in main category [](#delete-a-product-in-main-category)cafe24 youtube

DELETE /api/v2/admin/mains/{display\_group}/products/{product\_no}

###### DELETE

특정 메인분류에 배정된 상품을 삭제할 수 있습니다.  
해당 상품은 메인분류에서만 삭제될 뿐이고 실제로 상품 자체가 삭제되는것은 아닙니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **display\_group**  
**Required** | 

메인분류 번호

 |
| **product\_no**  
**Required** | 

상품번호

 |

Delete a product in main category

*   [Delete a product in main category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Mains properties

메인 화면에 표시되는 항목을 조회하고 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/mains/properties
POST /api/v2/admin/mains/properties
PUT /api/v2/admin/mains/properties
```

#### \[더보기 상세 내용\]

### Mains properties property list[](#mains-properties-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| display\_group | 

상세 상품분류

 |
| properties | 

항목 속성

 |
| property | 

항목 속성

 |

### Retrieve fields for products on the main screen [](#retrieve-fields-for-products-on-the-main-screen)cafe24

GET /api/v2/admin/mains/properties

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| display\_group  

_최소값: \[2\]_

 | 

상세 상품분류

DEFAULT 2

 |

Retrieve fields for products on the main screen

*   [Retrieve fields for products on the main screen](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a field for home page [](#create-a-field-for-home-page)cafe24

POST /api/v2/admin/mains/properties

###### POST

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| property | 
항목 속성

 |
| 

property 하위 요소 보기

**multishop\_display\_names** _Array_

multishop\_display\_names 하위 요소 보기

**shop\_no**  
멀티쇼핑몰 번호  
**Required**

**name**  
항목명 표시텍스트  
**Required**

**display**  
항목 표시여부  
DEFAULT F

**display\_name**  
항목명 표시설정  
T : 사용함  
F : 사용안함  
DEFAULT T

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)  
DEFAULT N

**font\_size**  
글자 크기  
DEFAULT 12

**font\_color**  
글자 색상  
DEFAULT #555555

**exposure\_group\_type**  
표시 대상 타입  
A: 전체  
M: 회원  
DEFAULT A







 |

Create a field for home page

*   [Create a field for home page](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update fields for products on the main screen [](#update-fields-for-products-on-the-main-screen)cafe24

PUT /api/v2/admin/mains/properties

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **display\_group**  
**Required**  

_최소값: \[2\]_

 | 

상세 상품분류

 |
| properties | 

항목 속성

 |
| 

properties 하위 요소 보기

**key**  
**Required**  
항목코드

**name**  
항목명 표시텍스트

**display**  
항목 표시여부

**display\_name**  
항목명 표시설정  
T : 사용함  
F : 사용안함

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)

**font\_size**  
글자 크기

**font\_color**  
글자 색상







 |

Update fields for products on the main screen

*   [Update fields for products on the main screen](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Products.png)  
  
상품(Products)은 쇼핑몰에서 거래되는 제품의 기본 단위입니다.  
컬러, 사이즈 같은 옵션이 있을 경우 각각의 옵션이 상품 하위의 품목으로 생성될 수 있��니다.  
상품은 상품명, 공급가, 판매가, 재고정보 등의 정보를 포함하고 있습니다.  
상품은 품목, 상품 메모, SEO 등 여러 하위 리소스들을 갖고 있습니다.

> Endpoints

```
GET /api/v2/admin/products
GET /api/v2/admin/products/count
GET /api/v2/admin/products/{product_no}
POST /api/v2/admin/products
PUT /api/v2/admin/products/{product_no}
DELETE /api/v2/admin/products/{product_no}
```

#### \[더보기 상세 내용\]

### Products property list[](#products-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| product\_no | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| product\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

상품코드

시스템이 상품에 부여한 코드. 해당 쇼핑몰 내에서 상품코드는 중복되지 않음.

 |
| custom\_product\_code  

_최대글자수 : \[40자\]_

 | 

자체상품 코드

사용자가 상품에 부여 가능한 코드. 재고 관리등의 이유로 자체적으로 상품을 관리 하고 있는 경우 사용함.

 |
| product\_name  

_최대글자수 : \[250자\]_

 | 

상품명

상품의 이름. 상품명은 상품을 구분하는 가장 기초적인 정보이며 검색 정보가 된다. HTML을 사용하여 입력이 가능하다.

 |
| eng\_product\_name  

_최대글자수 : \[250자\]_

 | 

영문 상품명

상품의 영문 이름. 해외 배송 등에 사용 가능함.

 |
| supply\_product\_name  

_최대글자수 : \[250자\]_

 | 

공급사 상품명

공급사에서 등록한 상품의 이름. 공급사에서 상품의 구분을 위해 임의로 입력할 수 있으며 상품명에는 영향을 미치지 않는다.

 |
| internal\_product\_name  

_최대글자수 : \[50자\]_

 | 

상품명(관리용)

 |
| model\_name  

_최대글자수 : \[100자\]_

 | 

모델명

상품의 모델명.

 |
| price\_excluding\_tax | 

상품가(세금 제외)

 |
| price | 

상품 판매가

상품의 판매 가격. 쿠폰 및 혜택을 적용하기 전의 가격.  
상품 등록시엔 모든 멀티 쇼핑몰에 동일한 가격으로 등록하며, 멀티쇼핑몰별로 다른 가격을 입력하고자 할 경우 상품 수정을 통해 가격을 다르게 입력할 수 있다.  
※ 판매가 = \[ 공급가 + (공급가 \* 마진율) + 추가금액 \]

 |
| retail\_price | 

상품 소비자가

시중에 판매되는 소비자 가격. 쇼핑몰의 가격을 강조하기 위한 비교 목적으로 사용함.

 |
| supply\_price | 

상품 공급가

상품의 원가. 공급가에 마진율을 더하여 판매가를 계산할 수 있음. API에서는 공급가는 참조 목적으로만 사용한다.

 |
| display | 

진열상태

상품을 쇼핑몰에 진열할지 여부. 상품을 쇼핑몰에 진열할 경우 설정한 상품분류와 메인화면에 표시된다. 상품이 쇼핑몰에 진열되어 있지 않으면 쇼핑몰 화면에 표시되지 않아 접근할 수 없으며 상품을 구매할 수 없다.

T : 진열함  
F : 진열안함

 |
| selling | 

판매상태

상품을 쇼핑몰에 판매할지 여부. 상품을 진열한 상태로 판매를 중지할 경우 상품은 쇼핑몰에 표시되지만 "품절"로 표시되어 상품을 구매할 수 없다. 상품이 "진열안함"일 경우 "판매함" 상태여도 상품에 접근할 수 없기 때문에 구매할 수 없다.

T : 판매함  
F : 판매안함

 |
| product\_condition | 

상품 상태

판매하는 상품의 상태 표시.

N : 신상품  
B : 반품상품  
R : 재고상품  
U : 중고상품  
E : 전시상품  
F : 리퍼상품  
S : 스크래치 상품

 |
| product\_used\_month  

_최대값: \[2147483647\]_

 | 

중고상품 사용 개월

 |
| summary\_description  

_최대글자수 : \[255자\]_

 | 

상품요약설명

상품에 대한 요약 정보. 상품 진열 화면에서 노출 가능한 설명. HTML을 사용하여 입력이 가능하다.  
\[쇼핑몰 설정 > 상품 설정 > '상품 보기 설정 > 상품 정보 표시 설정'\]에서 노출되도록 설정 가능하다.

 |
| product\_tag  

_배열 최대사이즈: \[50\]_

 | 

상품 검색어

쇼핑 큐레이션 사용 시 - 배열 최대사이즈 : \[100\]

 |
| margin\_rate  

_최소: \[-999.99\]~최대: \[999.99\]_

 | 

마진률

상품의 원가에 더하여 판매가 계산을 위한 마진율. Api에서는 해당 값은 참고용으로만 사용된다.  
tax\_calculation이 A(자동계산)일 경우 null로 반환됨.

 |
| tax\_calculation | 

세금 계산 유형

A : 자동 계산  
M : 수동 계산

 |
| tax\_type | 

과세 구분

해당 상품의 과세 정보.  
  
해당 상품의 부가세 포함 유형.  
과세상품 = 세금이 부과된 상품.  
면세상품 = 세금이 면제되는 상품. 가공되지 않은 농/수/축산물, 연탄, 도서류, 보험, 여성용품 등의 상품이 이에 해당하며, 과세사업자로 등록해야 함  
영세상품 = 부가세가 0%로 적용되는 수출용 외화 획득 상품  
  
tax\_calculation이 A(자동계산)이면서, C(영세상품) 일 경우 'A(과세상품)'으로 반환.

A : 과세상품  
B : 면세 상품  
C : 영세상품

 |
| tax\_rate  

_최소: \[1\]~최대: \[100\]_

 | 

과세율

 |
| price\_content  

_최대글자수 : \[20자\]_

 | 

판매가 대체문구

상품의 가격 대신 표시되는 문구. 품절이나 상품이 일시적으로 판매 불가할 때 사용.

 |
| buy\_limit\_by\_product | 

구매제한 개별 설정여부

T : 사용함  
F : 사용안함

 |
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

 |
| buy\_group\_list | 

구매가능 회원 등급

 |
| buy\_member\_id\_list | 

구매가능 회원아이디

 |
| repurchase\_restriction | 

재구매 제한

T : 재구매 불가  
F : 제한안함

 |
| single\_purchase\_restriction | 

단독구매 제한

T : 단독구매 불가  
F : 제한안함

 |
| single\_purchase | 

단독구매 설정

T : 단독구매 불가  
F : 제한안함  
O : 단독구매 전용

 |
| buy\_unit\_type | 

구매단위 타입

해당 상품의 구매 단위를 1개 이상으로 설정한 경우 해당 구매 단위를 품목 단위로 할 것인지, 상품 단위로 할 것인지에 대한 설정

P : 상품 기준  
O : 품목 기준

 |
| buy\_unit | 

구매단위

구매할 수 있는 최소한의 단위 표시.  
예) 구매 주문단위가 세 개일 경우, 3개, 6개, 9개 단위로 구매 가능함.

 |
| order\_quantity\_limit\_type | 

주문수량 제한 기준

해당 상품의 주문 수량 제한시 제한 기준을 품목 단위로 할 것인지, 상품 단위로 할 것인지에 대한 설정

P : 상품 기준  
O : 품목 기준

 |
| minimum\_quantity  

_최대값: \[2147483647\]_

 | 

최소 주문수량

주문 가능한 최소한의 주문 수량. 주문 수량 미만으로 구매 할 수 없음.

 |
| maximum\_quantity  

_최대값: \[2147483647\]_

 | 

최대 주문수량

주문 가능한 최대한의 주문 수량. 주문 수량을 초과하여 구매 할 수 없음.  
  
최대 주문수량이 "제한없음"일 경우 "0"으로 표시된다.

 |
| points\_by\_product | 

적립금 개별설정 사용여부

F : 기본설정 사용  
T : 개별설정

 |
| points\_setting\_by\_payment | 

결제방식별 적립금 설정 여부

B : 기본 적립금설정 사용  
C : 결제방식에 따른 적립

 |
| points\_amount | 

적립금 설정 정보

 |
| except\_member\_points | 

회원등급 추가 적립 제외

T : 회원등급 추가 적립 제외 설정함  
F : 회원등급 추가 적립 제외 설정안함

 |
| product\_volume | 

상품 부피 정보

 |
| adult\_certification | 

성인인증

성인인증이 필요한 상품인지 여부. 성인인증이 필요한 상품인 구매를 위해서는 본인인증을 거쳐야함.

T : 사용함  
F : 사용안함

 |
| detail\_image | 

상세이미지

상품 상세 화면에 표시되는 상품 이미지.

 |
| list\_image | 

목록이미지

상품 분류 화면, 메인 화면, 상품 검색 화면에 표시되는 상품의 목록 이미지.

 |
| tiny\_image | 

작은목록이미지

최근 본 상품 영역에 표시되는 상품의 목록 이미지.

 |
| small\_image | 

축소이미지

상품 상세 화면 하단에 표시되는 상품 목록 이미지.

 |
| use\_naverpay | 

네이버페이 사용여부

T : 사용함  
F : 사용안함

 |
| naverpay\_type | 

네이버페이 판매타입

C : 네이버페이 + 쇼핑몰 동시판매 상품  
O : 네이버페이 전용상품

 |
| manufacturer\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

제조사 코드

제조사를 등록하면 자동으로 생성되는 코드로 상품에 특정 제조사를 지정할 때 사용.  
  
미입력시 자체제작(M0000000) 사용

 |
| trend\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

트렌드 코드

트렌드를 등록하면 자동으로 생성되는 코드로 상품에 특정 트렌드를 지정할 때 사용.  
  
미입력시 기본트렌드(T0000000) 사용

 |
| brand\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

브랜드 코드

브랜드를 등록하면 자동으로 생성되는 코드로 상품에 특정 브랜드를 지정할 때 사용.  
  
미입력시 자체브랜드(B0000000) 사용

 |
| supplier\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

공급사 코드

공급사를 등록하면 자동으로 생성되는 코드로 상품에 특정 공급사를 지정할 때 사용.

 |
| made\_date | 

제조일자

상품을 제조한 제조일자.

 |
| release\_date | 

출시일자

상품이 시장에 출시된 일자.

 |
| expiration\_date  

_배열 최대사이즈: \[2\]_

 | 

유효기간

상품을 정상적으로 사용할 수 있는 기간. 상품권이나 티켓 같은 무형 상품, 식품이나 화장품 같은 유형 상품의 유효기간을 표시.  
  
주로 상품권이나 티켓 같은 무형 상품에 사용되며, 해당 무형 상품의 유효기간을 표시.

 |
| origin\_classification | 

원산지 국내/국외/기타

F : 국내  
T : 국외  
E : 기타

 |
| origin\_place\_no | 

원산지 번호

원산지 번호를 List all Origin API를 통해 원산지를 조회하여 입력  
origin\_classification이 F(국내)인 경우, 해외 여부(foreign)가 "F"인 원산지만 입력 가능함.  
origin\_classification이 T(해외)인 경우, 해외 여부(foreign)가 "T"인 원산지만 입력 가능함.

 |
| origin\_place\_value  

_최대글자수 : \[30자\]_

 | 

원산지기타정보

원산지가 "기타(1800)"일 경우 원산지로 입력 가능한 정보.

 |
| made\_in\_code | 

원산지 국가코드

 |
| icon\_show\_period | 

아이콘 노출 기간

상품에 설정한 아이콘이 노출되는 기간.

 |
| icon  

_배열 최대사이즈: \[5\]_

 | 

아이콘

상품에 표시되는 아이콘. 상품 판매를 강조하기 위한 목적으로 사용이 가능함.

 |
| hscode | 

HS코드

해외 배송시 관세 부과를 위해 사용하는 HS코드. ��제 배송시 통관을 위해 반드시 정확한 번호를 입력해야 함.  
  
※ HS코드 : 세계무역기구(WTO) 및 세계관세기구(WCO)가 무역통계 및 관세분류의 목적상 수출입 상품을 숫자 코드로 분류화 한 것으로, 수입 시 세금부과와 수출품의 통제 및 통계를 위한 분류법

 |
| product\_weight | 

상품 중량

상품의 전체 중량(kg). 배송을 위해 상품 자체의 무게와 박스 무게, 포장무게를 모두 포함한 중량 기재가 필요하다.

 |
| product\_material | 

상품소재

상품의 소재. 복합 소재일 경우 상품의 소재와 함유랑을 함께 입력해야함. (예 : 면 80%, 레이온 20%)

 |
| created\_date | 

생성일

상품이 생성된 일시.

 |
| updated\_date | 

수정일

상품이 수정된 일시.

 |
| english\_product\_material | 

영문 상품 소재

상품의 소재의 영어 표기. 해외 배송사를 이용할 경우 의류의 소재를 통관시 요구하는 경우가 있음.

 |
| cloth\_fabric | 

옷감

상품이 의류인 경우, 옷감. 일본 택배사를 이용할 경우, 택배사에 따라 의류 통관시 옷감 정보를 입력 받는 경우가 있음.

woven : 직물(woven)  
knit : 편물(knit)

 |
| list\_icon | 

추천 / 품절 / 신상품 아이콘 노출 여부

추천, 품절, 신상품 아이콘을 목록에서 표시하는지 여부  
  
※ 품절 아이콘  
  
● 상품이 품절 상태임을 알려주는 아이콘  
● 재고관리 및 품절 기능을 사용하는 상품에 대해 재고가 없을 경우 표시  
  
※ 추천, 신상품 아이콘  
  
● 상품분류나 메인화면의 추천상품, 신상품 영역에 진열된 상품인 경우, 설정에 따라 해당 아이콘을 표시함  
  
※ 아이콘 노출 여부 설정위치 : \[쇼핑몰 설정 > 상품 설정 > '상품 정책 설정 > 상품 관련 설정 > 상품 아이콘 설정'\]

 |
| approve\_status | 

승인요청 결과

N : 승인요청 (신규상품)  
E : 승인요청 (상품수정)  
C : 승인완료  
R : 승인거절  
I : 검수진행중  
Empty Value : 요청된적 없음

 |
| classification\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

자체분류 코드

 |
| sold\_out | 

품절여부

해당 상품이 품절되었는지 여부. 해당 상품이 재고를 사용하고 있고 모든 품목의 재고가 0이 되면 품절로 표시된다.

T : 품절  
F : 품절아님

 |
| additional\_price | 

판매가 추가금액

판매가 계산시 상품의 원가와 마진율에 더하여 추가로 계산되는 금액. API에서 해당 금액은 참고 목적으로만 사용된다.

 |
| discountprice | 

상품 할인판매가 리소스

 |
| decorationimages | 

꾸미기 이미지 리소스

 |
| benefits | 

혜택 리소스

 |
| options | 

상품 옵션 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| variants | 

품목 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| hits | 

상품 조회수 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| clearance\_category\_eng | 

해외통관용 상품구분 영문명

해외 통관시 통관용 상품 구분 정보로 사용하는 정보. 국문명 입력시 입력한 구분명이 자동으로 번역된 항목.  
  
번역된 영문명이 해외송장 상품명에 포함되어 전송됨.

 |
| clearance\_category\_kor | 

해외통관용 상품구분 국문명

해외 통관시 통관용 상품 구분 정보로 사용하는 정보. 자동으로 영문으로 번역되어 해외송장 상품명 정보에 포함하여 전송.

 |
| clearance\_category\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

해외통관코드

[clearance\_category\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/clearance_category_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| additionalimages | 

추가 이미지 리소스

 |
| exposure\_limit\_type | 

표시제한 범위

A : 모두에게 표시  
M : 회원에게만 표시

 |
| exposure\_group\_list | 

표시대상 회원 등급

 |
| set\_product\_type | 

세트상품 타입

C : 일반세트  
S : 분리세트

 |
| use\_kakaopay | 

카카오페이 사용여부

T : 사용함  
F : 사용안함

 |
| shipping\_fee\_by\_product | 

개별배송여부

상품에 배송비를 개별적으로 부과할 것인지 공통 배송비를 부과할 것인지에 대한 설정.  
개별 배송비를 사용하지 않을 경우 공통 배송비를 사용함.  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.

T : 사용함  
F : 사용안함

 |
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

 |
| main | 

메인진열

상품을 "추천상품", "신상품"과 같은 메인진열에 진열할 경우, 메인 진열 번호를 표시한다.

 |
| channeldiscountprices | 

상품 할인판매가 리소스

 |
| market\_sync | 

마켓 연동 여부

T : 사용함  
F : 사용안함

 |
| cultural\_tax\_deduction | 

문화비 소득공제

 |
| size\_guide | 

사이즈 가이드

 |
| memos | 

메모 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| seo | 

상품 Seo 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| category | 

분류 번호

해당 상품이 진열되어있는 상품 분류.

 |
| project\_no | 

기획전 번호

 |
| description | 

상품상세설명

상품에 보다 상세한 정보가 포함되어있는 설명. HTML을 사용하여 입력이 가능하다.

 |
| mobile\_description | 

모바일 상품 상세설명

입력시 모바일 쇼핑몰에서 상품상세설명 대신 모바일 상품 상세 설명을 대신 표시함.

 |
| separated\_mobile\_description | 

모바일 별도 등록

T : 직접등록  
F : 상품 상세설명 동일

 |
| translated\_description | 

상품상세설명 번역정보

 |
| payment\_info | 

상품결제안내

상품의 결제 방법에 대한 안내 문구. HTML을 사용하여 입력이 가능하다.

 |
| shipping\_info | 

상품배송안내

상품의 배송 방법에 대한 안내 문구. HTML을 사용하여 입력이 가능하다.

 |
| exchange\_info | 

교환/반품안내

상품의 교환/반품 방법에 대한 안내 문구. HTML을 사용하여 입력이 가능하다.

 |
| service\_info | 

서비스문의/안내

제품의 사후 고객 서비스 방법 대한 안내 문구. HTML을 사용하여 입력이 가능하다.

 |
| product\_tax\_type\_text | 

부가세 표시 문구

\[쇼핑몰 설정 > 상품 설정 > '상품 보기 설정 > 상품 정보 표시 설정 > 추가설정 > 판매가 부가세 표시문구'\]에서 설정한 문구 표시  
tax\_calculation이 A(자동계산)일 경우 null로 반환됨.

 |
| country\_hscode | 

국가별 HS 코드

해외 배송시 관세 부과를 위해 사용하는 HS코드. 국제 배송시 통관을 위해 반드시 정확한 번호를 입력해야 함.  
  
국가별로 HS 코드의 표준이 다르기 때문에 해당 국가에 맞는 코드 입력이 필요함.

 |
| simple\_description | 

상품 간략 설명

상품에 대한 간략한 정보. 상품 진열 화면에서 노출 가능한 설명. HTML을 사용하여 입력이 가능하다.  
\[쇼핑몰 설정 > 상품 설정 > '상품 보기 설정 > 상품 정보 표시 설정'\]에서 노출되도록 설정 가능하다.

 |
| tags | 

상품 태그 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| has\_option | 

옵션 사용여부

해당 상품이 옵션을 갖고 있는지에 대한 여부. 옵션을 갖고 있는 상품은 사이즈나 색상과 같은 다양한 선택지를 제공한다.

T : 옵션사용함  
F : 옵션 사용안함

 |
| soldout\_message  

_최대글자수 : \[250자\]_

 | 

품절표시 문구

 |
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

 |
| shipping\_calculation | 

배송 계산 유형

A : 자동 계산  
M : 수동 계산

 |
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

 |
| prepaid\_shipping\_fee | 

배송비 선결제 설정

shipping\_calculation이 A(자동계산)일 경우 null로 반환.

C : 착불  
P : 선결제  
B : 선결제/착불

 |
| shipping\_period | 

배송기간

(개별배송비를 사용할 경우) 상품 배송시 평균적으로 소요되는 배송 기간.  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.

 |
| shipping\_scope | 

배송정보

국내에만 배송이 가능한 상품인지 해외에도 배송이 가능한 상품인지 표시. \[쇼핑몰 설정 > 배송 설정 > '배송 정책 설정 > 배송비 설정 > 개별배송비 설정'\] 에서 상품별 개별배송료 설정이 사용안함인 경우 설정 불가.  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.

A : 국내배송  
C : 해외배송  
B : 국내/해외배송

 |
| shipping\_area  

_최대글자수 : \[255자\]_

 | 

배송지역

(개별배송비를 사용할 경우) 상품을 배송할 수 있는 지역.  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.

 |
| shipping\_rates | 

구간별 배송비

개별배송비를 사용할 경우 상품의 개별 배송비.  
  
shipping\_fee\_type이 R, N일 경우 배열 안에 shipping\_fee를 정의하여 배송비를 설정할 수 있다.  
  
shipping\_fee\_type이 M, D, W, C일 경우 배열 안에 다음과 같이 정의하여 배송비 구간을 설정할 수 있다.  
shipping\_rates\_min : 배송비 구간 시작 기준  
shipping\_rates\_max : 배송비 구간 종료 기준  
shipping\_fee : 배송비  
  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.

 |
| product\_shipping\_type | 

상품 배송유형

D : 사입배송  
C : 직접배송  
E : 기타(창고/위탁)

 |
| origin\_place\_code | 

원산지 코드

상품의 원산지 코드.

 |
| additional\_information | 

추가항목

\[쇼핑몰 설정 > 상품 설정 > '상품 보기 설정 > 상품 정보 표시 설정'\]에서 추가한 추가항목.  
  
기본적인 상품 정보 외에 추가로 표시항 항목이 있을 때 추가하여 사용함.

 |
| image\_upload\_type | 

이미지 업로드 타입

이미지 업로드시 이미지 업로드 타입.  
"대표이미지 등록"시 상세이미지를 리사이징하여 목록이미지, 작은목록이미지, 축소이미지에 업로드  
"개별이미지 등록"시 상세이미지, 목록이미지, 작은목록이미지, 축소이미지를 각각 따로 업로드  
  
※ EC Global은 FTP를 지원하지 않으므로 C는 사용할 수 없음

A : 대표이미지등록  
B : 개별이미지등록  
C : 웹FTP 등록

 |
| relational\_product  

_배열 최대사이즈: \[200\]_

 | 

관련상품

해당 상품과 비슷한 상품 혹은 대체 가능한 상품. 관련 상품 등록시 해당 상품의 상세페이지 하단에 노출된다.

 |
| select\_one\_by\_option | 

옵션별로 한 개씩 선택 (독립형 옵션)

독립형 옵션을 사용할 경우, 하나의 옵션을 여러개 중복하여 선택할 수 없고 한개씩만 선택 가능함.

T : 사용함  
F : 사용안함

 |
| translated\_additional\_description | 

상품 추가설명 번역정보

 |
| custom\_properties | 

상품 Seo 리소스

 |
| payment\_info\_by\_product | 

결제안내 개별설정 사용여부

T : 개별설정  
F : 기본설정 사용

 |
| service\_info\_by\_product | 

서비스문의/안내 개별설정 사용여부

T : 개별설정  
F : 기본설정 사용

 |
| shipping\_info\_by\_product | 

배송안내 개별설정 사용여부

T : 개별설정  
F : 기본설정 사용

 |
| exchange\_info\_by\_product | 

교환/반품안내 개별설정 사용여부

T : 개별설정  
F : 기본설정 사용

 |
| additional\_image  

_배열 최대사이즈: \[20\]_

 | 

추가이미지

상품 상세 화면 하단에 표시되는 상품의 추가 이미지. 축소 이미지와 비슷한 위치에 표시되며 PC 쇼핑몰에서는 마우스 오버시, 모바일 쇼핑몰에서는 이미지 스와이프(Swipe)시 추가 이미지를 확인할 수 있다.  
  
특정 상품 상세 조회 API에서만 확인 가능하다.

 |

### Retrieve a list of products [](#retrieve-a-list-of-products)cafe24 youtube

GET /api/v2/admin/products

###### GET

쇼핑몰에 생성되어 있는 상품을 목록으로 조회할 수 있습니다.  
상품코드, 상품명, 판매가 등을 조회할 수 있습니다.  
상품이 5,000개가 넘을 경우에는 offset 으로는 조회할 수 없으므로 since\_product\_no 파라메터를 활용해주시면 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| channeldiscountprices  
**embed** | 
상품 할인판매가 리소스

 |
| discountprice  
**embed** | 

상품 할인판매가 리소스

 |
| decorationimages  
**embed** | 

꾸미기 이미지 리소스

 |
| benefits  
**embed** | 

혜택 리소스

 |
| options  
**embed** | 

상품 옵션 리소스

 |
| variants  
**embed** | 

품목 리소스

상품당 품목정보를 100개까지 조회할 수 있음.  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| additionalimages  
**embed** | 

추가 이미지 리소스

 |
| hits  
**embed** | 

상품 조회수 리소스

 |
| shop\_no | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| product\_no | 

상품번호

조회하고자 하는 상품의 번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| display | 

진열상태

진열 혹은 미진열 되어있는 상품 검색.

 |
| selling | 

판매상태

판매중이거나 판매안함 상태의 상품 검색.

 |
| product\_name | 

상품명

검색어를 상품명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| product\_code | 

상품코드

검색어를 상품코드에 포함하고 있는 상품 검색(대소문자 구분 필요)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| brand\_code | 

브랜드 코드

브랜드 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.

 |
| manufacturer\_code | 

제조사 코드

제조사 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.

 |
| supplier\_code | 

공급사 코드

공급사 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.

 |
| trend\_code | 

트렌드 코드

트렌드 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.

 |
| product\_tag | 

상품 검색어

검색어를 상품 검색어 또는 태그에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| custom\_product\_code | 

자체상품 코드

검색어를 자체상품코드에 포함하고 있는 상품 검색(대소문자 구분 필요)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| custom\_variant\_code | 

자체 품목 코드

,(콤마)로 여러 건을 검색할 수 있다.

 |
| price\_min | 

상품 판매가 검색 최소값

판매가가 해당 범위 이상인 상품 검색

 |
| price\_max | 

상품 판매가 검색 최대값

판매가가 해당 범위 이하인 상품 검색

 |
| retail\_price\_min  

_최소값: \[0\]_  
_최대값: \[2147483647\]_

 | 

상품 소비자가 검색 최소값

소비자가가 해당 범위 이상인 상품 검색

 |
| retail\_price\_max  

_최소값: \[0\]_  
_최대값: \[2147483647\]_

 | 

상품 소비자가 검색 최대값

소비자가가 해당 범위 이하인 상품 검색

 |
| supply\_price\_min | 

상품 공급가 검색 최소값

공급가가 해당 범위 이하인 상품 검색

 |
| supply\_price\_max | 

상품 공급가 검색 최대값

공급가가 해당 범위 이상인 상품 검색

 |
| created\_start\_date | 

상품 등록일 검색 시작일

상품 등록일이 해당 날짜 이후인 상품 검색.  
  
등록일 검색 종료일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.

 |
| created\_end\_date | 

상품 등록일 검색 종료일

상품 등록일이 해당 날짜 이전인 상품 검색.  
  
등록일 검색 시작일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.

 |
| updated\_start\_date | 

상품 수정일 검색 시작일

상품 수정일이 해당 날짜 이후인 상품 검색.  
  
수정일 검색 종료일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.

 |
| updated\_end\_date | 

상품 수정일 검색 종료일

상품 수정일이 해당 날짜 이전인 상품 검색.  
  
수정일 검색 시작일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.

 |
| category | 

분류 번호

특정 분류에 진열된 상품 검색.

 |
| eng\_product\_name | 

영문 상품명

검색어를 영문 상품명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| supply\_product\_name | 

공급사 상품명

검색어를 공급사 상품명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| internal\_product\_name | 

상품명(관리용)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| model\_name | 

모델명

검색어를 모델명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| product\_condition | 

상품 상태

특정 상품 상태 검색

,(콤마)로 여러 건을 검색할 수 있다.

 |
| origin\_place\_value | 

원산지정보

원산지가 "기타(1800)"일 경우 원산지로 입력 가능한 정보.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| stock\_quantity\_max | 

재고수량 검색 최대값

재고가 해당 값 이하로 남아있는 상품 검색.  
  
품목을 여러개 갖고 있는 상품의 경우 해당 조건에 해당하는 품목이 하나라도 있을 경우 검색함.

 |
| stock\_quantity\_min | 

재고수량 검색 최소값

재고가 해당 값 이상 남아있는 상품 검색.  
  
품목을 여러개 갖고 있는 상품의 경우 해당 조건에 해당하는 품목이 하나라도 있을 경우 검색함.

 |
| stock\_safety\_max | 

안전재고수량 검색 최대값

 |
| stock\_safety\_min | 

안전재고수량 검색 최소값

 |
| product\_weight | 

상품 중량

해당 중량의 상품 검색.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| classification\_code | 

자체분류

,(콤마)로 여러 건을 검색할 수 있다.

 |
| use\_inventory | 

재고 사용여부

해당 상품 품목이 재고를 사용하고 있는지 여부

T : 사용함  
F : 사용안함

 |
| category\_unapplied | 

미적용 분류 검색

분류가 등록되지 않은 상품에 대하여 검색함.

T: 미적용 분류 검색

 |
| include\_sub\_category | 

하위분류 포함 검색

하위분류에 등록된 상품을 포함하여 검색함.

T: 포함

 |
| additional\_information\_key | 

추가항목 검색조건 키

추가항목에 대하여 검색하기 위한 키. 검색을 위해선 key 와 value 모두 필요함.

 |
| additional\_information\_value | 

추가항목 검색조건 값

추가항목에 대하여 검색하기 위한 키의 값. 검색을 위해선 key 와 value 모두 필요함.

 |
| approve\_status | 

승인상태 검색

N : 승인요청 (신규상품) 상태값  
E : 승인요청 (상품수정) 상태값  
C : 승인완료 상태값  
R : 승인거절 상태값  
I : 검수진행중 상태값

 |
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

 |
| product\_bundle | 

세트상품 여부

T : 사용함  
F : 사용안함

 |
| option\_type | 

옵션 구성방식

,(콤마)로 여러 건을 검색할 수 있다.

C : 조합 일체선택형  
S : 조합 분리선택형  
E : 상품 연동형  
F : 독립 선택형

 |
| market\_sync | 

마켓 연동 여부

T : 사용함  
F : 사용안함

 |
| sort | 

정렬 순서 값

created\_date : 등록일  
updated\_date : 수정일  
product\_name : 상품명

 |
| order | 

정렬 순서

asc : 순차정렬  
desc : 역순 정렬

 |
| offset  

_최대값: \[5000\]_

 | 

조회결과 시작위치

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

 |

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

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of products [](#retrieve-a-count-of-products)cafe24 youtube

GET /api/v2/admin/products/count

###### GET

쇼핑몰에 등록된 전체 상품의 수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| product\_no | 

상품번호

조회하고자 하는 상품의 번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| display | 

진열상태

진열 혹은 미진열 되어있는 상품 검색.

 |
| selling | 

판매상태

판매중이거나 판매안함 상태의 상품 검색.

 |
| product\_name | 

상품명

검색어를 상품명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| product\_code | 

상품코드

상품 코드

,(콤마)로 여러 건을 검색할 수 있다.

 |
| brand\_code | 

브랜드 코드

브랜드 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.

 |
| manufacturer\_code | 

제조사 코드

제조사 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.

 |
| supplier\_code | 

공급사 코드

공급사 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.

 |
| trend\_code | 

트렌드 코드

트렌드 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.

 |
| product\_tag | 

상품 검색어

검색어를 상품 검색어 또는 태그에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| custom\_product\_code | 

자체상품 코드

검색어를 자체상품코드에 포함하고 있는 상품 검색(대소문자 구분 필요)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| custom\_variant\_code | 

자체 품목 코드

,(콤마)로 여러 건을 검색할 수 있다.

 |
| price\_min | 

상품 판매가 검색 최소값

판매가가 해당 범위 이상인 상품 검색

 |
| price\_max | 

상품 판매가 검색 최대값

판매가가 해당 범위 이하인 상품 검색

 |
| retail\_price\_min  

_최소값: \[0\]_  
_최대값: \[2147483647\]_

 | 

상품 소비자가 검색 최소값

소비자가가 해당 범위 이상인 상품 검색

 |
| retail\_price\_max  

_최소값: \[0\]_  
_최대값: \[2147483647\]_

 | 

상품 소비자가 검색 최대값

소비자가가 해당 범위 이하인 상품 검색

 |
| supply\_price\_min | 

상품 공급가 검색 최소값

공급가가 해당 범위 이하인 상품 검색

 |
| supply\_price\_max | 

상품 공급가 검색 최대값

공급가가 해당 범위 이상인 상품 검색

 |
| created\_start\_date | 

상품 등록일 검색 시작일

상품 등록일이 해당 날짜 이후인 상품 검색.  
  
등록일 검색 종료일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.

 |
| created\_end\_date | 

상품 등록일 검색 종료일

상품 등록일이 해당 날짜 이전인 상품 검색.  
  
등록일 검색 시작일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.

 |
| updated\_start\_date | 

상품 수정일 검색 시작일

상품 수정일이 해당 날짜 이후인 상품 검색.  
  
수정일 검색 종료일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.

 |
| updated\_end\_date | 

상품 수정일 검색 종료일

상품 수정일이 해당 날짜 이전인 상품 검색.  
  
수정일 검색 시작일과 같이 사용해야함.  
  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색.

 |
| category | 

분류 번호

특정 분류에 진열된 상품 검색.

 |
| eng\_product\_name | 

영문 상품명

검색어를 영문 상품명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| supply\_product\_name | 

공급사 상품명

검색어를 공급사 상품명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| internal\_product\_name | 

상품명(관리용)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| model\_name | 

모델명

검색어를 모델명에 포함하고 있는 상품 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| product\_condition | 

상품 상태

특정 상품 상태 검색

,(콤마)로 여러 건을 검색할 수 있다.

 |
| origin\_place\_value | 

원산지정보

원산지가 "기타(1800)"일 경우 원산지로 입력 가능한 정보.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| stock\_quantity\_max | 

재고수량 검색 최대값

재고가 해당 값 이하로 남아있는 상품 검색.  
  
품목을 여러개 갖고 있는 상품의 경우 해당 조건에 해당하는 품목이 하나라도 있을 경우 검색함.

 |
| stock\_quantity\_min | 

재고수량 검색 최소값

재고가 해당 값 이상 남아있는 상품 검색.  
  
품목을 여러개 갖고 있는 상품의 경우 해당 조건에 해당하는 품목이 하나라도 있을 경우 검색함.

 |
| stock\_safety\_max | 

안전재고수량 검색 최대값

 |
| stock\_safety\_min | 

안전재고수량 검색 최소값

 |
| product\_weight | 

상품 중량

해당 중량의 상품 검색.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| classification\_code | 

자체분류

자체분류 코드가 일치하는 상품 검색

,(콤마)로 여러 건을 검색할 수 있다.

 |
| use\_inventory | 

재고 사용여부

해당 상품 품목이 재고를 사용하고 있는지 여부

T : 사용함  
F : 사용안함

 |
| category\_unapplied | 

미적용 분류 검색

분류가 등록되지 않은 상품에 대하여 검색함.

T: 미적용 분류 검색

 |
| include\_sub\_category | 

하위분류 포함 검색

하위분류에 등록된 상품을 포함하여 검색함.

T: 포함

 |
| additional\_information\_key | 

추가항목 검색조건 키

추가항목에 대하여 검색하기 위한 키. 검색을 위해선 key 와 value 모두 필요함.

 |
| additional\_information\_value | 

추가항목 검색조건 값

추가항목에 대하여 검색하기 위한 키의 값. 검색을 위해선 key 와 value 모두 필요함.

 |
| approve\_status | 

승인상태 검색

N : 승인요청 (신규상품) 상태값  
E : 승인요청 (상품수정) 상태값  
C : 승인완료 상태값  
R : 승인거절 상태값  
I : 검수진행중 상태값

 |
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

 |
| product\_bundle | 

세트상품 여부

T : 사용함  
F : 사용안함

 |
| option\_type | 

옵션 구성방식

,(콤마)로 여러 건을 검색할 수 있다.

C : 조합 일체선택형  
S : 조합 분리선택형  
E : 상품 연동형  
F : 독립 선택형

 |
| market\_sync | 

마켓 연동 여부

T : 사용함  
F : 사용안함

 |

Retrieve a count of products

*   [Retrieve a count of products](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a product resource [](#retrieve-a-product-resource)cafe24 youtube

GET /api/v2/admin/products/{product\_no}

###### GET

쇼핑몰에 생성되어 있는 상품을 조회할 수 있습니다.  
상품코드, 자체상품 코드, 상품명, 상품 판매가 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

조회하고자 하는 상품의 번호

 |
| variants  
**embed** | 

품목 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| memos  
**embed** | 

메모 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| hits  
**embed** | 

상품 조회수 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| seo  
**embed** | 

상품 Seo 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| tags  
**embed** | 

상품 태그 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| options  
**embed** | 

상품 옵션 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| discountprice  
**embed** | 

상품 할인판매가 리소스

 |
| decorationimages  
**embed** | 

꾸미기 이미지 리소스

 |
| benefits  
**embed** | 

혜택 리소스

 |
| additionalimages  
**embed** | 

추가 이미지 리소스

 |
| custom\_properties  
**embed** | 

사용자 정의 속성

 |

Retrieve a product resource

*   [Retrieve a product resource](#none)
*   [Retrieve a product with fields parameter](#none)
*   [Retrieve a product with embed](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a product [](#create-a-product)cafe24 youtube

POST /api/v2/admin/products

###### POST

쇼핑몰에 상품을 등록할 수 있습니다.  
상품을 등록하면서 옵션도 같이 등록할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| display | 
진열상태

**Youtube shopping 이용 시에는 미제공**

T : 진열함  
F : 진열안함

DEFAULT F

 |
| selling | 

판매상태

T : 판매함  
F : 판매안함

DEFAULT F

 |
| product\_condition | 

상품 상태

N : 신상품  
B : 반품상품  
R : 재고상품  
U : 중고상품  
E : 전시상품  
F : 리퍼상품  
S : 스크래치 상품

DEFAULT N

 |
| product\_used\_month  

_최대값: \[2147483647\]_

 | 

중고상품 사용 개월

상품 상태(product\_condition)가 중고 상품일 경우 중고 상품의 사용 개월 수

 |
| add\_category\_no | 

추가 분류 번호

**Youtube shopping 이용 시에는 미제공**

분류 번호를 사용하여 진열을 원하는 카테고리에 상품 등록

 |
| 

add\_category\_no 하위 요소 보기

**category\_no**  
**Required**  
분류 번호

**recommend**  
추천상품 분류 등록 여부  
T : 추천상품 등록  
F : 추천상품 등록안함  
DEFAULT F

**new**  
신상품 분류 등록 여부  
T : 신상품 등록  
F : 신상품 등록안함  
DEFAULT F







 |
| custom\_product\_code  

_최대글자수 : \[40자\]_

 | 

자체상품 코드

사용자가 상품에 부여 가능한 코드. 재고 관리등의 이유로 자체적으로 상품을 관리 하고 있는 경우 사용함.

 |
| **product\_name**  
**Required**  

_최대글자수 : \[250자\]_

 | 

상품명

 |
| eng\_product\_name  

_최대글자수 : \[250자\]_

 | 

영문 상품명

**Youtube shopping 이용 시에는 미제공**

 |
| supply\_product\_name  

_최대글자수 : \[250자\]_

 | 

공급사 상품명

 |
| internal\_product\_name  

_최대글자수 : \[50자\]_

 | 

상품명(관리용)

**Youtube shopping 이용 시에는 미제공**

 |
| model\_name  

_최대글자수 : \[100자\]_

 | 

모델명

**Youtube shopping 이용 시에는 미제공**

 |
| price\_excluding\_tax  

_최소: \[0\]~최대: \[2147483647\]_

 | 

상품가(세금 제외)

상품설정조회 [상품설정조회 Docs 바로가기](https://developers.cafe24.com/docs/api/admin/#retrieve-product-settings) 에서  
"판매가 계산 기준(calculate\_price\_based\_on)"이 "B(상품가)"일 경우 "price" 대신 필수 입력 필요.

 |
| price  

_최소: \[0\]~최대: \[2147483647\]_

 | 

상품 판매가

**필수 입력**  
  
단, 상품설정조회 [상품설정조회 Docs 바로가기](https://developers.cafe24.com/docs/api/admin/#retrieve-product-settings) 에서  
"판매가 계산 기준(calculate\_price\_based\_on)"이 "B(상품가)"일 경우 "price\_excludig\_tax"를 사용해야함.

 |
| retail\_price  

_최소: \[0\]~최대: \[2147483647\]_

 | 

상품 소비자가

 |
| **supply\_price**  
**Required**  

_최소: \[0\]~최대: \[2147483647\]_

 | 

상품 공급가

상품의 원가. 공급가에 마진율을 더하여 판매가를 계산할 수 있음. API에서는 공급가는 참조 목적으로만 사용한다.

 |
| has\_option | 

옵션 사용여부

T : 옵션사용함  
F : 옵션 사용안함

DEFAULT F

 |
| soldout\_message  

_최대글자수 : \[250자\]_

 | 

품절표시 문구

 |
| options | 

옵션

 |
| 

options 하위 요소 보기

**name**  
**Required**  
옵션명

**value**  
**Required**  
옵션값







 |
| use\_naverpay | 

네이버페이 사용여부

**Youtube shopping 이용 시에는 미제공**

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

T : 사용함  
F : 사용안함

 |
| naverpay\_type | 

네이버페이 판매타입

**Youtube shopping 이용 시에는 미제공**

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

C : 네이버페이 + 쇼핑몰 동시판매 상품  
O : 네이버페이 전용상품

 |
| manufacturer\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

제조사 코드

DEFAULT M0000000

 |
| trend\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

트렌드 코드

DEFAULT T0000000

 |
| brand\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

브랜드 코드

DEFAULT B0000000

 |
| supplier\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

공급사 코드

DEFAULT S0000000

 |
| product\_weight  

_최소: \[0\]~최대: \[999999.99\]_

 | 

상품 중량

 |
| made\_date | 

제조일자

 |
| release\_date | 

출시일자

 |
| expiration\_date  

_배열 최대사이즈: \[2\]_

 | 

유효기간

 |
| 

expiration\_date 하위 요소 보기

**start\_date**  
유효기간 시작일

**end\_date**  
유효기간 종료일







 |
| description | 

상품상세설명

 |
| mobile\_description | 

모바일 상품 상세설명

입력시 모바일 쇼핑몰에서 상품상세설명 대신 모바일 상품 상세 설명을 대신 표시함.

 |
| summary\_description  

_최대글자수 : \[255자\]_

 | 

상품요약설명

 |
| simple\_description | 

상품 간략 설명

**Youtube shopping 이용 시에는 미제공**

 |
| translated\_description | 

상품상세설명 번역정보

 |
| product\_tag  

_배열 최대사이즈: \[100\]_

 | 

상품 검색어

**Youtube shopping 이용 시에는 미제공**

쇼핑 큐레이션 사용 시 - 배열 최대사이즈 : \[100\]

 |
| payment\_info | 

상품결제안내

 |
| shipping\_info | 

상품배송안내

 |
| exchange\_info | 

교환/반품안내

 |
| service\_info | 

서비스문의/안내

 |
| icon  

_배열 최대사이즈: \[5\]_

 | 

아이콘

**Youtube shopping 이용 시에는 미제공**

 |
| hscode  

_최대글자수 : \[20자\]_

 | 

HS코드

배송정보(shipping\_scope)가 C(해외배송)일 경우 필수 입력  
shipping\_calculation이 A(자동계산)일 경우 필수 입력 아님

 |
| country\_hscode  

_배열 최대사이즈: \[29\]_

 | 

국가별 HS 코드

 |
| shipping\_scope | 

배송정보

국내에만 배송이 가능한 상품인지 해외에도 배송이 가능한 상품인지 표시. \[쇼핑몰 설정 > 배송 설정 > '배송 정책 설정 > 배송비 설정 > 개별배송비 설정'\] 에서 상품별 개별배송료 설정이 사용안함인 경우 설정 불가.  
  
※ 쇼핑몰이 EC Global 쇼핑몰일 경우 "C"를 필수로 입력해야한다.

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

A : 국내배송  
C : 해외배송  
B : 국내/해외배송

 |
| shipping\_method | 

배송방법

01 : 택배  
02 : 빠른등기  
03 : 일반등기  
04 : 직접배송  
05 : 퀵배송  
06 : 기타  
07 : 화물배송  
08 : 매장직접수령  
09 : 배송필요 없음

 |
| shipping\_fee\_by\_product | 

개별배송여부

T : 개별배송  
F : 기본배송

DEFAULT F

 |
| shipping\_area  

_최대글자수 : \[255자\]_

 | 

배송지역

 |
| shipping\_period  

_배열 최대사이즈: \[2\]_

 | 

배송기간

 |
| 

shipping\_period 하위 요소 보기

**minimum**  
최소 기간  
DEFAULT 1

**maximum**  
최대 기간  
DEFAULT 7







 |
| shipping\_fee\_type | 

배송비 타입

개별배송비를 사용할 경우 상품의 배송비 타입.

T : 배송비 무료  
R : 고정배송비 사용  
M : 구매 금액에 따른 부과  
D : 구매 금액별 차등 배송료 사용  
W : 상품 무게별 차등 배송료 사용  
C : 상품 수량별 차등 배송료 사용  
N : 상품 수량에 비례하여 배송료 부과

 |
| shipping\_rates  

_배열 최대사이즈: \[200\]_

 | 

배송비 금액

개별배송비를 사용할 경우 상품의 개별 배송비.  
  
shipping\_fee\_type이 R, N일 경우 배열 안에 shipping\_fee를 정의하여 배송비를 설정할 수 있다.  
  
shipping\_fee\_type이 M, D, W, C일 경우 배열 안에 다음과 같이 정의하여 배송비 구간을 설정할 수 있다.  
shipping\_rates\_min : 배송비 구간 시작 기준  
shipping\_rates\_max : 배송비 구간 종료 기준  
shipping\_fee : 배송비

 |
| 

shipping\_rates 하위 요소 보기

**shipping\_rates\_min**  
배송비 구간 시작 기준

**shipping\_rates\_max**  
배송비 구간 종료 기준

**shipping\_fee**  
배송비







 |
| prepaid\_shipping\_fee | 

배송비 선결제 설정

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

C : 착불  
P : 선결제  
B : 선결제/착불

 |
| clearance\_category\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

해외통관코드

배송정보(shipping\_scope)가 C(해외배송)일 경우 필수 입력  
shipping\_calculation이 A(자동계산)일 경우 필수 입력 아님  
[clearance\_category\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/clearance_category_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| product\_shipping\_type | 

상품 배송유형

D : 사입배송  
C : 직접배송  
E : 기타(창고/위탁)

 |
| detail\_image | 

상세이미지

 |
| list\_image | 

목록이미지

**Youtube shopping 이용 시에는 미제공**

 |
| tiny\_image | 

작은목록이미지

**Youtube shopping 이용 시에는 미제공**

 |
| small\_image | 

축소이미지

**Youtube shopping 이용 시에는 미제공**

 |
| image\_upload\_type | 

이미지 업로드 타입

**Youtube shopping 이용 시에는 미제공**

이미지 업로드시 이미지 업로드 타입.  
"대표이미지 등록"시 상세이미지를 리사이징하여 목록이미지, 작은목록이미지, 축소이미지에 업로드  
"개별이미지 등록"시 상세이미지, 목록이미지, 작은목록이미지, 축소이미지를 각각 따로 업로드  
  
※ EC Global은 FTP를 지원하지 않으므로 C는 사용할 수 없음

A : 대표이미지등록  
B : 개별이미지등록  
C : 웹FTP 등록

DEFAULT A

 |
| additional\_information | 

추가항목

**Youtube shopping 이용 시에는 미제공**

 |
| 

additional\_information 하위 요소 보기

**key**  
**Required**  
추가항목 키

**value**  
추가항목 값







 |
| price\_content  

_최대글자수 : \[20자\]_

 | 

판매가 대체문구

**Youtube shopping 이용 시에는 미제공**

 |
| buy\_limit\_by\_product | 

구매제한 개별 설정여부

**Youtube shopping 이용 시에는 미제공**

T : 사용함  
F : 사용안함

DEFAULT F

 |
| buy\_limit\_type | 

구매제한

**Youtube shopping 이용 시에는 미제공**

N : 회원만 구매하며  
구매버튼 감추기  
M : 회원만 구매하며  
구매버튼 보이기  
F : 구매제한 안함  
O : 지정된 회원만 구매하며 구매버튼 감추기  
D : 지정된 회원만 구매하며 구매버튼 보이기

DEFAULT F

 |
| buy\_group\_list | 

구매가능 회원 등급

**Youtube shopping 이용 시에는 미제공**

 |
| buy\_member\_id\_list | 

구매가능 회원아이디

**Youtube shopping 이용 시에는 미제공**

 |
| repurchase\_restriction | 

재구매 제한

**Youtube shopping 이용 시에는 미제공**

T : 재구매 불가  
F : 제한안함

DEFAULT F

 |
| single\_purchase\_restriction | 

단독구매 제한

**Youtube shopping 이용 시에는 미제공**

단독구매 설정(single\_purchase)에 값을 입력했을 경우, single\_purchase 값이 우선 적용됨

T : 단독구매 불가  
F : 제한안함

DEFAULT F

 |
| single\_purchase | 

단독구매 설정

**Youtube shopping 이용 시에는 미제공**

T : 단독구매 불가  
F : 제한안함  
O : 단독구매 전용

 |
| buy\_unit\_type | 

구매단위 타입

해당 상품의 구매 단위를 1개 이상으로 설정한 경우 해당 구매 단위를 품목 단위로 할 것인지, 상품 단위로 할 것인지에 대한 설정

P : 상품 기준  
O : 품목 기준

DEFAULT O

 |
| buy\_unit  

_최대값: \[2147483647\]_

 | 

구매단위

DEFAULT 1

 |
| order\_quantity\_limit\_type | 

주문수량 제한 기준

해당 상품의 주문 수량 제한시 제한 기준을 품목 단위로 할 것인지, 상품 단위로 할 것인지에 대한 설정

P : 상품 기준  
O : 품목 기준

DEFAULT O

 |
| minimum\_quantity  

_최대값: \[2147483647\]_

 | 

최소 주문수량

주문 가능한 최소한의 주문 수량. 주문 수량 미만으로 구매 할 수 없음.

DEFAULT 1

 |
| maximum\_quantity  

_최대값: \[2147483647\]_

 | 

최대 주문수량

주문 가능한 최대한의 주문 수량. 주문 수량을 초과하여 구매 할 수 없음.  
  
최대 주문수량을 "제한없음"으로 입력하려면 0을 입력

DEFAULT 0

 |
| points\_by\_product | 

적립금 개별설정 사용여부

**Youtube shopping 이용 시에는 미제공**

F : 기본설정 사용  
T : 개별설정

DEFAULT F

 |
| points\_setting\_by\_payment | 

결제방식별 적립금 설정 여부

**Youtube shopping 이용 시에는 미제공**

B : 기본 적립금설정 사용  
C : 결제방식에 따른 적립

 |
| points\_amount | 

적립금 설정 정보

**Youtube shopping 이용 시에는 미제공**

 |
| 

points\_amount 하위 요소 보기

**payment\_method**  
적립금 결제방법  
naverpay : 네이버페이  
smilepay : 스마일페이  
kakaopay : 카카오페이  
payco : 페이코  
paynow : 페이나우  
kpay : 케이페이  
icash : 가상계좌 결제  
deposit : 예치금 결제  
tcash : 실시간 계좌이체  
cell : 휴대폰 결제  
card : 카드 결제  
mileage : 적립금 결제  
cash : 무통장 입금

**points\_rate**  
적립율

**points\_unit\_by\_payment**  
결제방법별 적립금 단위  
P : 퍼센트 단위  
W : 원단위







 |
| except\_member\_points | 

회원등급 추가 적립 제외

**Youtube shopping 이용 시에는 미제공**

T : 회원등급 추가 적립 제외 설정함  
F : 회원등급 추가 적립 제외 설정안함

DEFAULT F

 |
| product\_volume | 

상품 부피 정보

 |
| 

product\_volume 하위 요소 보기

**use\_product\_volume**  
상품부피 사용여부

**product\_width**  
가로

**product\_height**  
세로

**product\_length**  
높이







 |
| origin\_classification | 

원산지 국내/국외/기타

F : 국내  
T : 국외  
E : 기타

 |
| origin\_place\_no | 

원산지 번호

원산지 번호를 Retrieve a list of origins API를 통해 원산지를 조회하여 입력  
origin\_classification이 F(국내)인 경우, 해외 여부(foreign)가 "F"인 원산지만 입력 가능함.  
origin\_classification이 T(해외)인 경우, 해외 여부(foreign)가 "T"인 원산지만 입력 가능함.

 |
| origin\_place\_value  

_최대글자수 : \[30자\]_

 | 

원산지기타정보

원산지가 "기타(1800)"일 경우 원산지로 입력 가능한 정보.

 |
| made\_in\_code | 

원산지 국가코드

원산지 국가를 두자리 국가코드로 입력  
  
원산지를 국가 단위로만 입력하는 경우 원산지 번호(origin\_place\_no)와 원산지 구분(origin\_classification) 대신 사용 가능하다.

 |
| main | 

메인진열

**Youtube shopping 이용 시에는 미제공**

상품을 "추천상품", "신상품"과 같은 메인진열에 진열할 경우, 메인 진열 번호를 표시한다.

 |
| relational\_product  

_배열 최대사이즈: \[200\]_

 | 

관련상품

**Youtube shopping 이용 시에는 미제공**

해당 상품과 비슷한 상품 혹은 대체 가능한 상품. 관련 상품 등록시 해당 상품의 상세페이지 하단에 노출된다.

 |
| 

relational\_product 하위 요소 보기

**product\_no**  
**Required**  
상품번호

**interrelated**  
**Required**  
관련상품 상호등록 여부  
T : 상호등록  
F : 일방등록







 |
| product\_material | 

상품소재

**Youtube shopping 이용 시에는 미제공**

상품의 소재. 복합 소재일 경우 상품의 소재와 함유랑을 함께 입력해야함. (예 : 면 80%, 레이온 20%)

 |
| translate\_product\_material | 

상품 소재 번역

T : 사용함  
F : 사용안함

 |
| english\_product\_material | 

영문 상품 소재

**Youtube shopping 이용 시에는 미제공**

상품의 소재의 영어 표기. 해외 배송사를 이용할 경우 의류의 소재를 통관시 요구하는 경우가 있음.

 |
| cloth\_fabric | 

옷감

**Youtube shopping 이용 시에는 미제공**

상품이 의류인 경우, 옷감. 일본 택배사를 이용할 경우, 택배사에 따라 의류 통관시 옷감 정보를 입력 받는 경우가 있음.

woven : 직물(woven)  
knit : 편물(knit)

 |
| classification\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

자체분류

 |
| additional\_price  

_최대값: \[2147483647\]_

 | 

판매가 추가금액

판매가 계산시 상품의 원가와 마진율에 더하여 추가로 계산되는 금액. API에서 해당 금액은 참고 목적으로만 사용된다.

 |
| margin\_rate  

_최소: \[-999.99\]~최대: \[999.99\]_

 | 

마진률

상품의 원가에 더하여 판매가 계산을 위한 마진율. Api에서는 해당 값은 참고용으로만 사용된다.

 |
| tax\_type | 

과세 구분

해당 상품의 과세 정보.  
  
해당 상품의 부가세 포함 유형.  
과세상품 = 세금이 부과된 상품.  
면세상품 = 세금이 면제되는 상품. 가공되지 않은 농/수/축산물, 연탄, 도서류, 보험, 여성용품 등의 상품이 이에 해당하며, 과세사업자로 등록해야 함  
영세상품 = 부가세가 0%로 적용되는 수출용 외화 획득 상품

A : 과세상품  
B : 면세 상품  
C : 영세상품

 |
| tax\_rate  

_최소: \[1\]~최대: \[100\]_

 | 

과세율

 |
| additional\_image | 

추가이미지

상품 상세 화면 하단에 표시되는 상품의 추가 이미지. 축소 이미지와 비슷한 위치에 표시되며 PC 쇼핑몰에서는 마우스 오버시, 모바일 쇼핑몰에서는 이미지 스와이프(Swipe)시 추가 이미지를 확인할 수 있다.  
  
추가이미지는 최대 20개까지 등록 가능하다.

 |
| adult\_certification | 

성인인증

성인인증이 필요한 상품인지 여부. 성인인증이 필요한 상품인 구매를 위해서는 본인인증을 거쳐야함.  
  
\[쇼핑몰 설정 > 고객 설정 > '회원 정책 설정 > 회원 관련 설정 > 회원가입 및 본인인증 설정'\] 에서 성인인증 사용 시 구매차단 설정이 사용함이어야 성인인증이 적용된다.

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

T : 사용함  
F : 사용안함

DEFAULT F

 |
| exposure\_limit\_type | 

표시제한 범위

**Youtube shopping 이용 시에는 미제공**

A : 모두에게 표시  
M : 회원에게만 표시

DEFAULT A

 |
| exposure\_group\_list | 

표시대상 회원 등급

**Youtube shopping 이용 시에는 미제공**

 |
| use\_kakaopay | 

카카오페이 사용여부

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

T : 사용함  
F : 사용안함

 |
| cultural\_tax\_deduction | 

문화비 소득공제

**Youtube shopping 이용 시에는 미제공**

T : 사용함  
F : 사용안함

 |
| size\_guide | 

사이즈 가이드

**Youtube shopping 이용 시에는 미제공**

 |
| 

size\_guide 하위 요소 보기

**use**  
사용여부  
T : 사용함  
F : 사용안함  
DEFAULT F

**type**  
타입  
default : 기본 가이드 사용  
custom : 직접등록  
DEFAULT default

**default**  
기본 가이드 사용  
Male: 남성사이즈  
Female: 여성사이즈  
Child: 아동사이즈  
Infant: 유아사이즈

**description**  
사이즈가이드 설명







 |

Create a product

*   [Create a product](#none)
*   [Create a product using only required fields](#none)
*   [Try creating a product without product\_name](#none)
*   [Create a hidden product](#none)
*   [Create a product with options](#none)
*   [Create a product with additional information](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a product [](#update-a-product)cafe24 youtube

PUT /api/v2/admin/products/{product\_no}

###### PUT

쇼핑몰에 생성되어 있는 상품을 수정할 수 있습니다.  
진열상태, 판매상태, 상품명 등을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| display | 

진열상태

**Youtube shopping 이용 시에는 미제공**

상품을 쇼핑몰에 진열할지 여부 변경.

T : 진열함  
F : 진열안함

 |
| selling | 

판매상태

T : 판매함  
F : 판매안함

 |
| product\_condition | 

상품 상태

N : 신상품  
B : 반품상품  
R : 재고상품  
U : 중고상품  
E : 전시상품  
F : 리퍼상품  
S : 스크래치 상품

 |
| product\_used\_month  

_최대값: \[2147483647\]_

 | 

중고상품 사용 개월

상품 상태(product\_condition)가 중고 상품일 경우 중고 상품의 사용 개월 수

 |
| add\_category\_no | 

추가 분류 번호

**Youtube shopping 이용 시에는 미제공**

상품분류 번호를 입력하여 해당 상품에 특정 상품분류를 추가 등록

 |
| 

add\_category\_no 하위 요소 보기

**category\_no**  
**Required**  
분류 번호

**recommend**  
추천상품 분류 등록 여부  
T : 추천상품 등록  
F : 추천상품 등록안함  
DEFAULT F

**new**  
신상품 분류 등록 여부  
T : 신상품 등록  
F : 신상품 등록안함  
DEFAULT F







 |
| delete\_category\_no | 

삭제 분류 번호

**Youtube shopping 이용 시에는 미제공**

상품분류 번호를 입력하여 해당 상품에 특정 상품분류 삭제

 |
| custom\_product\_code  

_최대글자수 : \[40자\]_

 | 

자체상품 코드

사용자가 상품에 부여 가능한 코드. 재고 관리등의 이유로 자체적으로 상품을 관리 하고 있는 경우 사용함.

 |
| product\_name  

_최대글자수 : \[250자\]_

 | 

상품명

 |
| eng\_product\_name  

_최대글자수 : \[250자\]_

 | 

영문 상품명

**Youtube shopping 이용 시에는 미제공**

 |
| supply\_product\_name  

_최대글자수 : \[250자\]_

 | 

공급사 상품명

 |
| internal\_product\_name  

_최대글자수 : \[50자\]_

 | 

상품명(관리용)

**Youtube shopping 이용 시에는 미제공**

 |
| model\_name  

_최대글자수 : \[100자\]_

 | 

모델명

**Youtube shopping 이용 시에는 미제공**

 |
| price\_excluding\_tax  

_최소: \[0\]~최대: \[2147483647\]_

 | 

상품가(세금 제외)

상품설정조회(GET:/products/setting) 에서 "판매가 계산 기준(calculate\_price\_based\_on)"이 "B(상품가)"일 경우 Price가 아니라 price\_excluding\_tax를 입력해야한다.

 |
| price  

_최소: \[0\]~최대: \[2147483647\]_

 | 

상품 판매가

tax\_calculation이 A(자동계산)일 경우,  
상품설정조회(GET:/products/setting)의 "판매가 계산 기준(calculate\_price\_based\_on)" 값과 상관없이  
price로만 입력해야 한다.

 |
| retail\_price  

_최소: \[0\]~최대: \[2147483647\]_

 | 

상품 소비자가

 |
| supply\_price  

_최소: \[0\]~최대: \[2147483647\]_

 | 

상품 공급가

상품의 원가. 공급가에 마진율을 더하여 판매가를 계산할 수 있음. API에서는 공급가는 참조 목적으로만 사용한다.

 |
| soldout\_message  

_최대글자수 : \[250자\]_

 | 

품절표시 문구

 |
| use\_naverpay | 

네이버페이 사용여부

**Youtube shopping 이용 시에는 미제공**

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

T : 사용함  
F : 사용안함

 |
| naverpay\_type | 

네이버페이 판매타입

**Youtube shopping 이용 시에는 미제공**

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

C : 네이버페이 + 쇼핑몰 동시판매 상품  
O : 네이버페이 전용상품

 |
| manufacturer\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

제조사 코드

 |
| trend\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

트렌드 코드

 |
| brand\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

브랜드 코드

 |
| supplier\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

공급사 코드

 |
| product\_weight  

_최소: \[0\]~최대: \[999999.99\]_

 | 

상품 중량

 |
| made\_date | 

제조일자

 |
| release\_date | 

출시일자

 |
| expiration\_date  

_배열 최대사이즈: \[2\]_

 | 

유효기간

 |
| 

expiration\_date 하위 요소 보기

**start\_date**  
유효기간 시작일

**end\_date**  
유효기간 종료일







 |
| description | 

상품상세설명

 |
| mobile\_description | 

모바일 상품 상세설명

입력시 모바일 쇼핑몰에서 상품상세설명 대신 모바일 상품 상세 설명을 대신 표시함.

 |
| translated\_description | 

상품상세설명 번역정보

 |
| translated\_additional\_description | 

상품 추가설명 번역정보

 |
| summary\_description  

_최대글자수 : \[255자\]_

 | 

상품요약설명

 |
| simple\_description | 

상품 간략 설명

**Youtube shopping 이용 시에는 미제공**

 |
| product\_tag  

_배열 최대사이즈: \[100\]_

 | 

상품 검색어

**Youtube shopping 이용 시에는 미제공**

쇼핑 큐레이션 사용 시 - 배열 최대사이즈 : \[100\]

 |
| payment\_info | 

상품결제안내

 |
| shipping\_info | 

상품배송안내

 |
| exchange\_info | 

교환/반품안내

 |
| service\_info | 

서비스문의/안내

 |
| icon  

_배열 최대사이즈: \[5\]_

 | 

아이콘

**Youtube shopping 이용 시에는 미제공**

 |
| use\_icon\_exposure\_term | 

표시기간 사용 여부

**Youtube shopping 이용 시에는 미제공**

T : 사용함  
F : 사용안함

 |
| icon\_exposure\_begin\_datetime | 

표시기간 시작 일자

**Youtube shopping 이용 시에는 미제공**

 |
| icon\_exposure\_end\_datetime | 

표시기간 종료 일자

**Youtube shopping 이용 시에는 미제공**

 |
| hscode  

_최대글자수 : \[20자\]_

 | 

HS코드

배송정보(shipping\_scope)가 C(해외배송)일 경우 필수 입력  
shipping\_calculation이 A(자동계산)일 경우 필수 입력 아님

 |
| country\_hscode  

_배열 최대사이즈: \[29\]_

 | 

국가별 HS 코드

 |
| shipping\_scope | 

배송정보

국내에만 배송이 가능한 상품인지 해외에도 배송이 가능한 상품인지 표시. \[쇼핑몰 설정 > 배송 설정 > '배송 정책 설정 > 배송비 설정 > 개별배송비 설정'\] 에서 상품별 개별배송료 설정이 사용안함인 경우 설정 불가.

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

A : 국내배송  
C : 해외배송  
B : 국내/해외배송

 |
| shipping\_method | 

배송방법

01 : 택배  
02 : 빠른등기  
03 : 일반등기  
04 : 직접배송  
05 : 퀵배송  
06 : 기타  
07 : 화물배송  
08 : 매장직접수령  
09 : 배송필요 없음

 |
| shipping\_fee\_by\_product | 

개별배송여부

T : 개별배송  
F : 기본배송

 |
| shipping\_area  

_최대글자수 : \[255자\]_

 | 

배송지역

 |
| shipping\_period | 

배송기간

 |
| 

shipping\_period 하위 요소 보기

**minimum**  
최소 기간  
DEFAULT 1

**maximum**  
최대 기간  
DEFAULT 7







 |
| shipping\_fee\_type | 

배송비 타입

개별배송비를 사용할 경우 상품의 배송비 타입.

T : 배송비 무료  
R : 고정배송비 사용  
M : 구매 금액에 따른 부과  
D : 구매 금액별 차등 배송료 사용  
W : 상품 무게별 차등 배송료 사용  
C : 상품 수량별 차등 배송료 사용  
N : 상품 수량에 비례하여 배송료 부과

 |
| shipping\_rates  

_배열 최대사이즈: \[200\]_

 | 

배송비 금액

개별배송비를 사용할 경우 상품의 개별 배송비.  
  
shipping\_fee\_type이 R, N일 경우 배열 안에 shipping\_fee를 정의하여 배송비를 설정할 수 있다.  
  
shipping\_fee\_type이 M, D, W, C일 경우 배열 안에 다음과 같이 정의하여 배송비 구간을 설정할 수 있다.  
shipping\_rates\_min : 배송비 구간 시작 기준  
shipping\_rates\_max : 배송비 구간 종료 기준  
shipping\_fee : 배송비

 |
| 

shipping\_rates 하위 요소 보기

**shipping\_rates\_min**  
배송비 구간 시작 기준

**shipping\_rates\_max**  
배송비 구간 종료 기준

**shipping\_fee**  
배송비







 |
| prepaid\_shipping\_fee | 

배송비 선결제 설정

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

C : 착불  
P : 선결제  
B : 선결제/착불

 |
| clearance\_category\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

해외통관코드

배송정보(shipping\_scope)가 C(해외배송)일 경우 필수 입력  
shipping\_calculation이 A(자동계산)일 경우 필수 입력 아님  
[clearance\_category\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/clearance_category_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| product\_shipping\_type | 

상품 배송유형

D : 사입배송  
C : 직접배송  
E : 기타(창고/위탁)

 |
| detail\_image | 

상세이미지

 |
| list\_image | 

목록이미지

**Youtube shopping 이용 시에는 미제공**

 |
| tiny\_image | 

작은목록이미지

**Youtube shopping 이용 시에는 미제공**

 |
| small\_image | 

축소이미지

**Youtube shopping 이용 시에는 미제공**

 |
| image\_upload\_type | 

이미지 업로드 타입

**Youtube shopping 이용 시에는 미제공**

이미지 업로드시 이미지 업로드 타입.  
"대표이미지 등록"시 상세이미지를 리사이징하여 목록이미지, 작은목록이미지, 축소이미지에 업로드  
"개별이미지 등록"시 상세이미지, 목록이미지, 작은목록이미지, 축소이미지를 각각 따로 업로드  
  
※ EC Global은 FTP를 지원하지 않으므로 C는 사용할 수 없음

A : 대표이미지등록  
B : 개별이미지등록  
C : 웹FTP 등록

 |
| additional\_information | 

추가항목

**Youtube shopping 이용 시에는 미제공**

 |
| 

additional\_information 하위 요소 보기

**key**  
**Required**  
추가항목 키

**value**  
추가항목 값







 |
| price\_content  

_최대글자수 : \[20자\]_

 | 

판매가 대체문구

**Youtube shopping 이용 시에는 미제공**

 |
| buy\_limit\_by\_product | 

구매제한 개별 설정여부

**Youtube shopping 이용 시에는 미제공**

T : 사용함  
F : 사용안함

 |
| buy\_limit\_type | 

구매제한

**Youtube shopping 이용 시에는 미제공**

N : 회원만 구매하며  
구매버튼 감추기  
M : 회원만 구매하며  
구매버튼 보이기  
F : 구매제한 안함  
O : 지정된 회원만 구매하며 구매버튼 감추기  
D : 지정된 회원만 구매하며 구매버튼 보이기

 |
| buy\_group\_list | 

구매가능 회원 등급

**Youtube shopping 이용 시에는 미제공**

 |
| buy\_member\_id\_list | 

구매가능 회원아이디

**Youtube shopping 이용 시에는 미제공**

 |
| repurchase\_restriction | 

재구매 제한

**Youtube shopping 이용 시에는 미제공**

T : 재구매 불가  
F : 제한안함

 |
| single\_purchase\_restriction | 

단독구매 제한

**Youtube shopping 이용 시에는 미제공**

단독구매 설정(single\_purchase)에 값을 입력했을 경우, single\_purchase 값이 우선 적용됨

T : 단독구매 불가  
F : 제한안함

 |
| single\_purchase | 

단독구매 설정

**Youtube shopping 이용 시에는 미제공**

T : 단독구매 불가  
F : 제한안함  
O : 단독구매 전용

 |
| buy\_unit\_type | 

구매단위 타입

해당 상품의 구매 단위를 1개 이상으로 설정한 경우 해당 구매 단위를 품목 단위로 할 것인지, 상품 단위로 할 것인지에 대한 설정

P : 상품 기준  
O : 품목 기준

 |
| buy\_unit  

_최대값: \[2147483647\]_

 | 

구매단위

 |
| order\_quantity\_limit\_type | 

주문수량 제한 기준

해당 상품의 주문 수량 제한시 제한 기준을 품목 단위로 할 것인지, 상품 단위로 할 것인지에 대한 설정

P : 상품 기준  
O : 품목 기준

 |
| minimum\_quantity  

_최대값: \[2147483647\]_

 | 

최소 주문수량

 |
| maximum\_quantity  

_최대값: \[2147483647\]_

 | 

최대 주문수량

주문 가능한 최대한의 주문 수량. 주문 수량을 초과하여 구매 할 수 없음.  
  
최대 주문수량을 "제한없음"으로 입력하려면 0을 입력  
  
최소주문수량 수정시 최대주문수량을 같이 수정해야한다.

 |
| points\_by\_product | 

적립금 개별설정 사용여부

**Youtube shopping 이용 시에는 미제공**

F : 기본설정 사용  
T : 개별설정

 |
| points\_setting\_by\_payment | 

결제방식별 적립금 설정 여부

**Youtube shopping 이용 시에는 미제공**

B : 기본 적립금설정 사용  
C : 결제방식에 따른 적립

 |
| points\_amount | 

적립금 설정 정보

**Youtube shopping 이용 시에는 미제공**

 |
| 

points\_amount 하위 요소 보기

**payment\_method**  
적립금 결제방법  
naverpay : 네이버페이  
smilepay : 스마일페이  
kakaopay : 카카오페이  
payco : 페이코  
paynow : 페이나우  
kpay : 케이페이  
icash : 가상계좌 결제  
deposit : 예치금 결제  
tcash : 실시간 계좌이체  
cell : 휴대폰 결제  
card : 카드 결제  
mileage : 적립금 결제  
cash : 무통장 입금

**points\_rate**  
적립율

**points\_unit\_by\_payment**  
결제방법별 적립금 단위  
P : 퍼센트 단위  
W : 원단위







 |
| except\_member\_points | 

회원등급 추가 적립 제외

**Youtube shopping 이용 시에는 미제공**

T : 회원등급 추가 적립 제외 설정함  
F : 회원등급 추가 적립 제외 설정안함

 |
| product\_volume | 

상품 부피 정보

 |
| 

product\_volume 하위 요소 보기

**use\_product\_volume**  
상품부피 사용여부

**product\_width**  
가로

**product\_height**  
세로

**product\_length**  
높이







 |
| origin\_classification | 

원산지 국내/국외/기타

F : 국내  
T : 국외  
E : 기타

 |
| origin\_place\_no | 

원산지 번호

원산지 번호를 List all Origin API를 통해 원산지를 조회하여 입력  
origin\_classification이 F(국내)인 경우, 해외 여부(foreign)가 "F"인 원산지만 입력 가능함.  
origin\_classification이 T(해외)인 경우, 해외 여부(foreign)가 "T"인 원산지만 입력 가능함.

 |
| origin\_place\_value  

_최대글자수 : \[30자\]_

 | 

원산지기타정보

원산지가 "기타(1800)"일 경우 원산지로 입력 가능한 정보.

 |
| made\_in\_code | 

원산지 국가코드

원산지 국가를 두자리 국가코드로 입력  
  
원산지를 국가 단위로만 입력하는 경우 원산지 번호(origin\_place\_no)와 원산지 구분(origin\_classification) 대신 사용 가능하다.

 |
| main | 

메인진열

**Youtube shopping 이용 시에는 미제공**

상품을 "추천상품", "신상품"과 같은 메인진열에 진열할 경우, 메인 진열 번호를 표시한다.

 |
| relational\_product  

_배열 최대사이즈: \[200\]_

 | 

관련상품

**Youtube shopping 이용 시에는 미제공**

해당 상품과 비슷한 상품 혹은 대체 가능한 상품. 관련 상품 등록시 해당 상품의 상세페이지 하단에 노출된다.

 |
| 

relational\_product 하위 요소 보기

**product\_no**  
상품번호

**interrelated**  
**Required**  
관련상품 상호등록 여부  
T : 상호등록  
F : 일방등록







 |
| product\_material | 

상품소재

**Youtube shopping 이용 시에는 미제공**

상품의 소재. 복합 소재일 경우 상품의 소재와 함유랑을 함께 입력해야함. (예 : 면 80%, 레이온 20%)

 |
| translate\_product\_material | 

상품 소재 번역

T : 사용함  
F : 사용안함

 |
| english\_product\_material | 

영문 상품 소재

**Youtube shopping 이용 시에는 미제공**

상품의 소재의 영어 표기. 해외 배송사를 이용할 경우 의류의 소재를 통관시 요구하는 경우가 있음.

 |
| cloth\_fabric | 

옷감

**Youtube shopping 이용 시에는 미제공**

상품이 의류인 경우, 옷감. 일본 택배사를 이용할 경우, 택배사에 따라 의류 통관시 옷감 정보를 입력 받는 경우가 있음.

woven : 직물(woven)  
knit : 편물(knit)

 |
| classification\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

자체분류

 |
| additional\_price  

_최대값: \[2147483647\]_

 | 

판매가 추가금액

판매가 계산시 상품의 원가와 마진율에 더하여 추가로 계산되는 금액. API에서 해당 금액은 참고 목적으로만 사용된다.

 |
| margin\_rate  

_최소: \[-999.99\]~최대: \[999.99\]_

 | 

마진률

상품의 원가에 더하여 판매가 계산을 위한 마진율. Api에서는 해당 값은 참고용으로만 사용된다.

 |
| tax\_type | 

과세 구분

해당 상품의 과세 정보.  
  
해당 상품의 부가세 포함 유형.  
과세상품 = 세금이 부과된 상품.  
면세상품 = 세금이 면제되는 상품. 가공되지 않은 농/수/축산물, 연탄, 도서류, 보험, 여성용품 등의 상품이 이에 해당하며, 과세사업자로 등록해야 함  
영세상품 = 부가세가 0%로 적용되는 수출용 외화 획득 상품

A : 과세상품  
B : 면세 상품  
C : 영세상품

 |
| tax\_rate  

_최소: \[1\]~최대: \[100\]_

 | 

과세율

 |
| additional\_image | 

추가이미지

상품 상세 화면 하단에 표시되는 상품의 추가 이미지. 축소 이미지와 비슷한 위치에 표시되며 PC 쇼핑몰에서는 마우스 오버시, 모바일 쇼핑몰에서는 이미지 스와이프(Swipe)시 추가 이미지를 확인할 수 있다.  
  
추가이미지는 최대 20개까지 등록 가능하다.

 |
| adult\_certification | 

성인인증

성인인증이 필요한 상품인지 여부. 성인인증이 필요한 상품인 구매를 위해서는 본인인증을 거쳐야함.  
  
\[쇼핑몰 설정 > 고객 설정 > '회원 정책 설정 > 회원 관련 설정 > 회원가입 및 본인인증 설정'\] 에서 성인인증 사용 시 구매차단 설정이 사용함이어야 성인인증이 적용된다.

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

T : 사용함  
F : 사용안함

 |
| exposure\_limit\_type | 

표시제한 범위

**Youtube shopping 이용 시에는 미제공**

A : 모두에게 표시  
M : 회원에게만 표시

 |
| exposure\_group\_list | 

표시대상 회원 등급

**Youtube shopping 이용 시에는 미제공**

 |
| use\_kakaopay | 

카카오페이 사용여부

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

T : 사용함  
F : 사용안함

 |
| cultural\_tax\_deduction | 

문화비 소득공제

**Youtube shopping 이용 시에는 미제공**

T : 사용함  
F : 사용안함

 |
| size\_guide | 

사이즈 가이드

**Youtube shopping 이용 시에는 미제공**

 |
| 

size\_guide 하위 요소 보기

**use**  
사용여부  
T : 사용함  
F : 사용안함

**type**  
타입  
default : 기본 가이드 사용  
custom : 직접등록

**default**  
기본 가이드 사용  
Male: 남성사이즈  
Female: 여성사이즈  
Child: 아동사이즈  
Infant: 유아사이즈

**description**  
사이즈가이드 설명







 |

Update a product

*   [Update a product](#none)
*   [Update the product to hidden](#none)
*   [Update additional information of the product](#none)
*   [Update the tag of product](#none)
*   [Update the product to sold out](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a product [](#delete-a-product)cafe24 youtube

DELETE /api/v2/admin/products/{product\_no}

###### DELETE

쇼핑몰에 생성되어 있는 상품을 삭제할 수 있습니다.  
상품 삭제 시에는 상품 하위에 옵션(품목)도 함께 삭제됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |

Delete a product

*   [Delete a product](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products additionalimages

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20additionalimages.png)  
  
상품 추가 이미지(Products additionalimages)는 상품의 추가이미지를 나타내는 하위 리소스로, 상품(Products)리소스의 하위에서만 사용할 수 있습니다.

> Endpoints

```
POST /api/v2/admin/products/{product_no}/additionalimages
PUT /api/v2/admin/products/{product_no}/additionalimages
DELETE /api/v2/admin/products/{product_no}/additionalimages
```

#### \[더보기 상세 내용\]

### Products additionalimages property list[](#products__additionalimages-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| additional\_image | 

추가이미지

 |
| product\_no | 

상품번호

 |

### Create an additional product image [](#create-an-additional-product-image)cafe24 youtube

POST /api/v2/admin/products/{product\_no}/additionalimages

###### POST

해당 상품의 추가 이미지를 등록할 수 있습니다.  
추가 이미지 업로드시 Base64로 인코드하여 업로드할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |
| **additional\_image**  
**Required** | 

추가이미지

● 최대요청건수 : 20개  
● 이미지 파일 용량 제한 : 5MB  
● 한 호출당 이미지 전체 용량 제한 : 30MB

 |

Create an additional product image

*   [Create an additional product image](#none)
*   [Try uploading over 20 additional images to a product](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update an additional product image [](#update-an-additional-product-image)cafe24 youtube

PUT /api/v2/admin/products/{product\_no}/additionalimages

###### PUT

해당 상품의 추가 이미지를 수정할 수 있습니다.  
추가 이미지 업로드시 Base64로 인코드하여 업로드할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |
| **additional\_image**  
**Required** | 

추가이미지

● 최대요청건수 : 20개  
● 이미지 파일 용량 제한 : 5MB  
● 한 호출당 이미지 전체 용량 제한 : 30MB

 |

Update an additional product image

*   [Update an additional product image](#none)
*   [Try updating over 20 additional images to a product](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete an additional product image [](#delete-an-additional-product-image)cafe24 youtube

DELETE /api/v2/admin/products/{product\_no}/additionalimages

###### DELETE

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |

Delete an additional product image

*   [Delete an additional product image](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products approve

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20approve.png)  
  
상품 승인(Products approve)은 공급사가 업로드한 상품을 검토 후 승인하는 기능입니다.  
해당 기능은 일부 쇼핑몰에만 적용된 상태로, 공급사 상품 승인 기능을 사용중인 몰에서만 사용할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/products/{product_no}/approve
POST /api/v2/admin/products/{product_no}/approve
PUT /api/v2/admin/products/{product_no}/approve
```

#### \[더보기 상세 내용\]

### Products approve property list[](#products__approve-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| **status**  
**Required** | 

상태

공급사가 승인 요청한 해당 상품의 승인 상태

N : 승인요청 (신규상품) 상태값  
E : 승인요청 (상품수정) 상태값  
C : 승인완료 상태값  
R : 승인거절 상태값  
I : 검수진행중 상태값  
Empty Value : 요청된적 없음

 |
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |

### Retrieve a product approval status [](#retrieve-a-product-approval-status)cafe24

GET /api/v2/admin/products/{product\_no}/approve

###### GET

해당 상품의 승인 상태를 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |

Retrieve a product approval status

*   [Retrieve a product approval status](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a product approval request [](#create-a-product-approval-request)cafe24

POST /api/v2/admin/products/{product\_no}/approve

###### POST

해당 상품에 대한 승인 신청을 할 수 있습니다.  
승인신청한 상품은 승인요청(신규상품) 상태로 승인 요청됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| **user\_id**  
**Required** | 

공급사 운영자 아이디

승인 요청한 공급사의 아이디

 |

Create a product approval request

*   [Create a product approval request](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a product approval status [](#update-a-product-approval-status)cafe24

PUT /api/v2/admin/products/{product\_no}/approve

###### PUT

해당 상품의 승인 상태를 변경할 수 있습니다.  
대표관리자가 상품을 승인한 경우 승인완료로 업데이트할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| **user\_id**  
**Required** | 

공급사 운영자 아이디

승인 요청한 공급사의 아이디

 |
| **status**  
**Required** | 

상태

공급사가 승인 요청한 해당 상품의 승인 상태

C : 승인완료 상태값  
R : 승인거절 상태값  
I : 검수진행중 상태값

 |

Update a product approval status

*   [Update a product approval status](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products customproperties

상품에 등록된 사용자정의 속성을 관리 기능을 제공합니다.

> Endpoints

```
GET /api/v2/admin/products/{product_no}/customproperties
PUT /api/v2/admin/products/{product_no}/customproperties/{property_no}
DELETE /api/v2/admin/products/{product_no}/customproperties/{property_no}
```

#### \[더보기 상세 내용\]

### Products customproperties property list[](#products__customproperties-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| custom\_properties | 

자체 정의 속성

 |

### Retrieve user-defined properties by product [](#retrieve-user-defined-properties-by-product)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/customproperties

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |

Retrieve user-defined properties by product

*   [Retrieve user-defined properties by product](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update user-defined properties by product [](#update-user-defined-properties-by-product)cafe24 youtube

PUT /api/v2/admin/products/{product\_no}/customproperties/{property\_no}

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **product\_no**  
**Required** | 
상품번호

 |
| **property\_no**  
**Required** | 

자체 정의 속성 번호

 |
| shop\_no  

_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| property\_value | 

자체 정의 속성 값

 |

Update user-defined properties by product

*   [Update user-defined properties by product](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete user-defined properties by product [](#delete-user-defined-properties-by-product)cafe24 youtube

DELETE /api/v2/admin/products/{product\_no}/customproperties/{property\_no}

###### DELETE

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |
| **property\_no**  
**Required** | 

자체 정의 속성 번호

 |

Delete user-defined properties by product

*   [Delete user-defined properties by product](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products decorationimages

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20decorationimages.png)  
  
꾸미기 이미지(Decorationimages)는 쇼핑몰에 진열된 상품 이미지 위에 추가하여 상품에 포인트를 줄 수 있는 기능입니다.  
쇼핑몰에 등록되어있는 꾸미기 이미지를 조회하여 상품별로 꾸미기 이미지를 지정하거나, 상품에 등록되어있는 꾸미기 이미지를 조회할 수 있습니다.  
꾸미기 이미지는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/products/{product_no}/decorationimages
POST /api/v2/admin/products/{product_no}/decorationimages
PUT /api/v2/admin/products/{product_no}/decorationimages
DELETE /api/v2/admin/products/{product_no}/decorationimages/{code}
```

#### \[더보기 상세 내용\]

### Products decorationimages property list[](#products__decorationimages-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| use\_show\_date | 

표시기간 사용 여부

T : 사용함  
F : 사용안함

 |
| show\_start\_date | 

표시기간 시작 일자

 |
| show\_end\_date | 

표시기간 종료 일자

 |
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

 |
| code | 

꾸미기 이미지 코드

 |

### Retrieve a list of product decoration images [](#retrieve-a-list-of-product-decoration-images)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/decorationimages

###### GET

특정 상품에 등록되어 있는 꾸미기 이미지를 목록으로 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |

Retrieve a list of product decoration images

*   [Retrieve a list of product decoration images](#none)
*   [Retrieve decorationimages with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Set decoration images for a product [](#set-decoration-images-for-a-product)cafe24 youtube

POST /api/v2/admin/products/{product\_no}/decorationimages

###### POST

꾸미기 이미지를 상품에 추가할 수 있습니다.  
꾸미기 이미지 추가시 표시 기간과 꾸미기 이미지의 위치 등을 설정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |
| use\_show\_date | 

표시기간 사용 여부

T : 사용함  
F : 사용안함

 |
| show\_start\_date  

_날짜_

 | 

표시기간 시작 일자

 |
| show\_end\_date  

_날짜_

 | 

표시기간 종료 일자

 |
| **image\_list**  
**Required** | 

꾸미기 이미지 리스트

수평위치(image\_horizontal\_position)  
L : 왼쪽  
C : 가운데  
R : 오른쪽  
  
수직위치(image\_vertical\_position)  
T : 상단  
C : 중단  
B : 하단

 |
| 

image\_list 하위 요소 보기

**code**  
꾸미기 이미지 코드

**path**  
꾸미기 이미지 경로

**image\_horizontal\_position**  
꾸미기 이미지 수평값

**image\_vertical\_position**  
꾸미기 이미지 수직값







 |

Set decoration images for a product

*   [Set decoration images for a product](#none)
*   [Set a decoration images to a product by using only required fields](#none)
*   [Try setting a decoration images to a product with wrong position](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update product decoration images [](#update-product-decoration-images)cafe24 youtube

PUT /api/v2/admin/products/{product\_no}/decorationimages

###### PUT

상품번호를 이용하여 해당 상품의 꾸미기 이미지를 수정할 수 있습니다.  
표시기간 사용 여부, 표시기간 시작 일자, 종료 일자 등을 변경할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| use\_show\_date | 

표시기간 사용 여부

T : 사용함  
F : 사용안함

 |
| show\_start\_date  

_날짜_

 | 

표시기간 시작 일자

 |
| show\_end\_date  

_날짜_

 | 

표시기간 종료 일자

 |
| **image\_list**  
**Required** | 

꾸미기 이미지 리스트

수평위치(image\_horizontal\_position)  
L : 왼쪽  
C : 가운데  
R : 오른쪽  
  
수직위치(image\_vertical\_position)  
T : 상단  
C : 중단  
B : 하단

 |
| 

image\_list 하위 요소 보기

**code**  
꾸미기 이미지 코드

**path**  
꾸미기 이미지 경로

**image\_horizontal\_position**  
꾸미기 이미지 수평값

**image\_vertical\_position**  
꾸미기 이미지 수직값







 |

Update product decoration images

*   [Update product decoration images](#none)
*   [Update vertical position and horizontal position of decoration images](#none)
*   [Update display periods of decoration images](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Remove a product decoration image [](#remove-a-product-decoration-image)cafe24 youtube

DELETE /api/v2/admin/products/{product\_no}/decorationimages/{code}

###### DELETE

상품에 등록된 꾸미기 이미지를 삭제합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **code**  
**Required** | 

꾸미기 이미지 코드

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |

Remove a product decoration image

*   [Remove a product decoration image](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products discountprice

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20discountprice.png)  
  
상품 할인가(Discountprice)는 상품의 할인가격을 표시하는 리소스입니다. 혜택(Benefits)이 적용된 상품의 경우 상품의 할인가를 조회할 수 있습니다.  
상품 할인가는 하위 리소스로서 상품(Products) 하위에서만 사용가능하며, 상품 목록 조회시 Embed 파라메터로 호출가능합니다.

> Endpoints

```
GET /api/v2/admin/products/{product_no}/discountprice
```

#### \[더보기 상세 내용\]

### Products discountprice property list[](#products__discountprice-property-list)

| **Attribute** | **Description** |
| --- | --- |
| pc\_discount\_price | 
PC 할인 판매가

 |
| mobile\_discount\_price | 

모바일 할인 판매가

 |
| app\_discount\_price | 

앱 할인 판매가

 |

### Retrieve a product discounted price [](#retrieve-a-product-discounted-price)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/discountprice

###### GET

상품번호를 이용하여 해당 상품의 할인가를 조회합니다.  
PC 할인 판매가, 모바일 할인 판매가를 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |

Retrieve a product discounted price

*   [Retrieve a product discounted price](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products hits

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20hits.png)  
  
상품 조회수(Hits)는 상품을 쇼핑몰 고객들이 얼마나 조회했는지를 나타내는 지표입니다.  
상품 조회수를 확인하면, 고객들이 어떤 상품을 가장 많이 조회하는지 알 수 있습니다.  
상품 조회수는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/products/{product_no}/hits/count
```

#### \[더보기 상세 내용\]

### Retrieve a count of product views [](#retrieve-a-count-of-product-views)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/hits/count

###### GET

상품번호를 이용하여 해당 상품의 조회수를 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |

Retrieve a count of product views

*   [Retrieve a count of product views](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products icons

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20icons.png)  
  
상품 아이콘은 상품을 강조하기 위해 상품 옆에 추가할 수 있는 작은 이미지들입니다. 진열된 상품에 할인 정보, "매진 임박" 등의 메시지를 추가하여 상품을 강조할 수 있습니다.  
상품 아이콘는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/products/{product_no}/icons
POST /api/v2/admin/products/{product_no}/icons
PUT /api/v2/admin/products/{product_no}/icons
DELETE /api/v2/admin/products/{product_no}/icons/{code}
```

#### \[더보기 상세 내용\]

### Products icons property list[](#products__icons-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| use\_show\_date | 

표시기간 사용 여부

T : 사용함  
F : 사용안함

 |
| show\_start\_date | 

표시기간 시작 일자

 |
| show\_end\_date | 

표시기간 종료 일자

 |
| image\_list | 

상품 아이콘 리스트

 |
| code | 

상품 아이콘 코드

 |

### Retrieve a list of product icons [](#retrieve-a-list-of-product-icons)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/icons

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |

Retrieve a list of product icons

*   [Retrieve a list of product icons](#none)
*   [Retrieve icons with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Set icons for a product [](#set-icons-for-a-product)cafe24 youtube

POST /api/v2/admin/products/{product\_no}/icons

###### POST

상품 아이콘을 상품에 등록할 수 있습니다.  
아이콘을 상품에 등록하기 전에 우선 List all icons 를 통해 아이콘의 코드를 확인해주세요.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |
| **image\_list**  
**Required**  

_배열 최대사이즈: \[5\]_

 | 

상품 아이콘 리스트

 |
| 

image\_list 하위 요소 보기

**code**  
**Required**  
상품 아이콘 코드







 |

Set icons for a product

*   [Set icons for a product](#none)
*   [Try selecting product icons without image\_list field](#none)
*   [Set an icon to a product by using only required fields](#none)
*   [Try setting an icon to a product by without using image\_list fields](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update product icons [](#update-product-icons)cafe24 youtube

PUT /api/v2/admin/products/{product\_no}/icons

###### PUT

상품에 등록한 상품 아이콘을 수정할 수 있습니다.  
아이콘의 표시여부, 표시기간 등을 변경할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |
| use\_show\_date | 

표시기간 사용 여부

T : 사용함  
F : 사용안함

 |
| show\_start\_date  

_날짜_

 | 

표시기간 시작 일자

 |
| show\_end\_date  

_날짜_

 | 

표시기간 종료 일자

 |
| image\_list  

_배열 최대사이즈: \[5\]_

 | 

상품 아이콘 리스트

 |
| 

image\_list 하위 요소 보기

**code**  
**Required**  
상품 아이콘 코드







 |

Update product icons

*   [Update product icons](#none)
*   [Update icons of the product](#none)
*   [Update display dates of icons](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Remove a product icon [](#remove-a-product-icon)cafe24 youtube

DELETE /api/v2/admin/products/{product\_no}/icons/{code}

###### DELETE

상품에 등록된 상품 아이콘을 삭제(등록해제) 할 수 있습니다.  
아이콘 자체는 삭제되지 않으며 상품에 등록된 상태만 해제됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |
| **code**  
**Required** | 

상품 아이콘 코드

 |

Remove a product icon

*   [Remove a product icon](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products images

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20images.png)  
  
상품 이미지(Products Images)는 상품의 판매를 위해서 업로드한 상품의 사진이나 그림을 의미합니다.  
상품 이미지 API를 사용해 상품 상세설명에서 사용할 이미지를 업로드하거나, 상품의 이미지를 업로드할 수 있습니다.  
상품의 이미지는 Base64 코드 로 인코딩하여 업로드할 수 있습니다

> Endpoints

```
POST /api/v2/admin/products/{product_no}/images
DELETE /api/v2/admin/products/{product_no}/images
```

#### \[더보기 상세 내용\]

### Products images property list[](#products__images-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| product\_no | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| detail\_image | 

상세이미지

상품 상세 화면에 표시되는 상품 이미지.

 |
| list\_image | 

목록이미지

상품 분류 화면, 메인 화면, 상품 검색 화면에 표시되는 상품의 목록 이미지.

 |
| tiny\_image | 

작은목록이미지

상품 상세 화면 하단에 표시되는 상품 목록 이미지.

 |
| small\_image | 

축소이미지

최근 본 상품 영역에 표시되는 상품의 목록 이미지.

 |

### Upload product images [](#upload-product-images)cafe24 youtube

POST /api/v2/admin/products/{product\_no}/images

###### POST

이미지를 상품에 등록할 수 있습니다.  
상품의 상세, 목록, 작은목록, 축소 이미지를 등록할 수 있습니다.  
이미지를 등록하기 전에 이미지가 업로드 되어있는지 먼저 확인해주세요.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| detail\_image | 

상세이미지

상품 상세 화면에 표시되는 상품 이미지.

 |
| list\_image | 

목록이미지

**Youtube shopping 이용 시에는 미제공**

상품 분류 화면, 메인 화면, 상품 검색 화면에 표시되는 상품의 목록 이미지.

 |
| tiny\_image | 

작은목록이미지

**Youtube shopping 이용 시에는 미제공**

상품 상세 화면 하단에 표시되는 상품 목록 이미지.

 |
| small\_image | 

축소이미지

**Youtube shopping 이용 시에는 미제공**

최근 본 상품 영역에 표시되는 상품의 목록 이미지.

 |
| **image\_upload\_type**  
**Required** | 

이미지 업로드 타입

**Youtube shopping 이용 시에는 미제공**

이미지 타입이 대표 이미지 인지, 개별 이미지 인지 업로드 타입을 지정할 수 있음. 대표 이미지(A)로 업로드 하는 경우 상세이미지(detail\_image)에 이미지를 업로드하면 다른 나머지 이미지에도 모두 반영됨.

A : 대표이미지등록  
B : 개별이미지등록

 |

Upload product images

*   [Upload product images](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete product images [](#delete-product-images)cafe24 youtube

DELETE /api/v2/admin/products/{product\_no}/images

###### DELETE

상품에 등록된 이미지를 삭제할 수 있습니다.  
상세이미지나 목록이미지 등의 구분 없이 상품에 등록된 모든 이미지가 삭제됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |

Delete product images

*   [Delete product images](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products memos

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20memos.png)  
  
상품 메모(Products memos)는 상품에 관한 특이사항을 메모하거나 운영자 간의 의사소통을 위한 도구로 활용할 수 있습니다.  
상품 메모는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/products/{product_no}/memos
GET /api/v2/admin/products/{product_no}/memos/{memo_no}
POST /api/v2/admin/products/{product_no}/memos
PUT /api/v2/admin/products/{product_no}/memos/{memo_no}
DELETE /api/v2/admin/products/{product_no}/memos/{memo_no}
```

#### \[더보기 상세 내용\]

### Products memos property list[](#products__memos-property-list)

| **Attribute** | **Description** |
| --- | --- |
| memo\_no | 
메모 번호

시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| author\_id  

_최대글자수 : \[20자\]_

 | 

작성자 아이디

메모를 작성한 관리자의 아이디 정보.

 |
| created\_date | 

생성일

메모를 작성한 시간.

 |
| memo | 

메모

메모의 내용. HTML을 사용하여 등록할 수 있다.

 |

### Retrieve a list of product memos [](#retrieve-a-list-of-product-memos)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/memos

###### GET

특정 상품에 등록된 메모를 목록으로 조회할 수 있습니다.  
작성자 아이디, 생성일, 메모 내용 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **product\_no**  
**Required** | 
상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

 |

Retrieve a list of product memos

*   [Retrieve a list of product memos](#none)
*   [Retrieve memos using paging](#none)
*   [Retrieve memos with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a product memo [](#retrieve-a-product-memo)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/memos/{memo\_no}

###### GET

특정 상품에 등록된 메모 1개를 조회할 수 있습니다.  
작성자 아이디, 생성일, 메모내용 등을 조회할 수 있습니다.  
메모를 조회하기 위해선 메모번호가 필요합니다. 메모번호는 List all products memos 를 통해 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **product\_no**  
**Required** | 
상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| **memo\_no**  
**Required** | 

메모 번호

시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다.

 |

Retrieve a product memo

*   [Retrieve a product memo](#none)
*   [Retrieve a product memo with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a product memo [](#create-a-product-memo)cafe24 youtube

POST /api/v2/admin/products/{product\_no}/memos

###### POST

특정 상품에 대한 메모를 등록할 수 있습니다.  
메모를 등록할 때에는 메모 작성자의 아이디를 입력해야 합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **product\_no**  
**Required** | 
상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| **author\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

작성자 아이디

메모를 작성한 관리자의 아이디 정보.

 |
| **memo**  
**Required** | 

메모

메모의 내용. HTML을 사용하여 등록할 수 있다.

 |

Create a product memo

*   [Create a product memo](#none)
*   [Post a product memo](#none)
*   [Try posting a product memo without author\_id field](#none)
*   [Try posting a product memo without memo field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a product memo [](#update-a-product-memo)cafe24 youtube

PUT /api/v2/admin/products/{product\_no}/memos/{memo\_no}

###### PUT

특정 상품에 등록된 메모를 수정할 수 있습니다.  
메모를 수정할 때에는 메모 작성자의 아이디와 메모번호를 입력해야 합니다.  
메모번호는 List all products memos 를 통해 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **product\_no**  
**Required** | 
상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| **memo\_no**  
**Required** | 

메모 번호

시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| **author\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

작성자 아이디

메모를 작성한 관리자의 아이디 정보.

 |
| **memo**  
**Required** | 

메모

메모의 내용. HTML을 사용하여 등록할 수 있다.

 |

Update a product memo

*   [Update a product memo](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a product memo [](#delete-a-product-memo)cafe24 youtube

DELETE /api/v2/admin/products/{product\_no}/memos/{memo\_no}

###### DELETE

특정 상품에 등록된 메모를 삭제할 수 있습니다.  
메모를 삭제하기 위해선 메모번호가 필요합니다. 메모번호는 List all products memos 를 통해 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **product\_no**  
**Required** | 
상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| **memo\_no**  
**Required** | 

메모 번호

시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다.

 |

Delete a product memo

*   [Delete a product memo](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

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
GET /api/v2/admin/products/{product_no}/options
POST /api/v2/admin/products/{product_no}/options
PUT /api/v2/admin/products/{product_no}/options
DELETE /api/v2/admin/products/{product_no}/options
```

#### \[더보기 상세 내용\]

### Products options property list[](#products__options-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| has\_option | 

옵션 사용여부

T : 사용함  
F : 사용안함

 |
| option\_type | 

옵션 구성방식

옵션을 사용할 경우, 옵션의 유형 표시  
  
● 조합형 : 옵션명을 기준으로 옵션값을 조합할 수 있음  
● 상품 연동형 : 옵션표시방식은 조합형과 유사하지만 필수옵션과 선택옵션을 선택할 수 있음. 옵션의 조합을 제한 없이 생성할 수 있음.  
● 독립 선택형 : 독립적인 조건 여러개를 각각 선택할 수 있는 옵션으로 옵션 값이 조합되지 않고 각각의 품목으로 생성됨.

T : 조합형  
E : 연동형  
F : 독립형

 |
| option\_list\_type | 

옵션 표시방식

조합형 옵션을 사용할 경우, 조합형 옵션의 유형 표시  
  
\* 조합 일체선택형 : 하나의 셀렉스박스(버튼 이나 라디오버튼)에 모든 옵션이 조합되어 표시됨  
\* 조합 분리선택형 : 옵션을 각각의 셀렉스박스(버튼 이나 라디오버튼)로 선택할 수 있으며 옵션명을 기준으로 옵션값을 조합할 수 있음  
  
독립형이나 상품 연동형 옵션을 사용하고 있을 경우 S(분리형)로 입력됨.

C : 일체형  
S : 분리형

 |
| option\_preset\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

옵션세트 코드

상품연동형 옵션을 사용할 경우, 옵션 세트 코드 표시

 |
| options | 

옵션

 |
| select\_one\_by\_option | 

옵션별로 한 개씩 선택 (독립형 옵션)

독립형 옵션을 사용할 경우, 하나의 옵션을 여러개 중복하여 선택할 수 없고 한개씩만 선택 가능함.

T : 사용함  
F : 사용안함

 |
| option\_preset\_name | 

연동형 옵션 세트명

상품연동형 옵션을 사용할 경우, 옵션 세트의 이름 표시

 |
| use\_additional\_option | 

추가입력 옵션 사용여부

T : 사용함  
F : 사용안함

 |
| additional\_options | 

추가입력 옵션

 |
| use\_attached\_file\_option | 

파일 첨부 옵션 사용여부

T : 사용함  
F : 사용안함

 |
| attached\_file\_option | 

파일 첨부 옵션

 |

### Retrieve a list of product options [](#retrieve-a-list-of-product-options)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/options

###### GET

상품의 옵션을 목록으로 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |

Retrieve a list of product options

*   [Retrieve a list of product options](#none)
*   [Retrieve options with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create product options [](#create-product-options)cafe24 youtube

POST /api/v2/admin/products/{product\_no}/options

###### POST

상품의 옵션을 생성하여 등록할 수 있습니다.  
옵션을 등록하면 품목�� 자동으로 생성됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| has\_option | 

옵션 사용여부

T : 사용함  
F : 사용안함

 |
| option\_type | 

옵션 구성방식

옵션을 사용할 경우, 옵션의 유형 입력  
  
● 조합형 : 옵션명을 기준으로 옵션값을 조합할 수 있음  
● 상품 연동형 : 옵션표시방식은 조합형과 유사하지만 필수옵션과 선택옵션을 선택할 수 있음. 옵션의 조합을 제한 없이 생성할 수 있음.  
● 독립 선택형 : 독립적인 조건 여러개를 각각 선택할 수 있는 옵션으로 옵션 값이 조합되지 않고 각각의 품목으로 생성됨.

T : 조합형  
E : 연동형  
F : 독립형

 |
| option\_list\_type | 

옵션 표시방식

조합형 옵션을 사용할 경우, 조합형 옵션의 유형 입력  
  
\* 조합 일체선택형 : 하나의 셀렉스박스(버튼 이나 라디오버튼)에 모든 옵션이 조합되어 표시됨  
\* 조합 분리선택형 : 옵션을 각각의 셀렉스박스(버튼 이나 라디오버튼)로 선택할 수 있으며 옵션명을 기준으로 옵션값을 조합할 수 있음  
  
독립형이나 상품 연동형 옵션을 사용하고 있을 경우 S(분리형)로 입력됨.

S : 조합 분리선택형  
C : 조합 일체선택형

 |
| options | 

옵션

 |
| 

options 하위 요소 보기

**option\_name**  
**Required**  
옵션명

**option\_value** _Array_

option\_value 하위 요소 보기

**option\_text**  
옵션값  
**Required**

**option\_image\_file**  
옵션 버튼 이미지

**option\_color**  
컬러칩 색상

**option\_display\_type**  
옵션 표시방식  
S : 셀렉트박스  
P : 미리보기  
B : 텍스트버튼  
R : 라디오버튼  
DEFAULT S







 |
| select\_one\_by\_option | 

옵션별로 한 개씩 선택 (독립형 옵션)

독립형 옵션을 사용할 경우, 하나의 옵션을 여러개 중복하여 선택할 수 없고 한개씩만 선택 가능함.

T : 사용함  
F : 사용안함 독립형에만 존재 체크시 옵션별로 한개씩 선택 값 처리

 |
| option\_preset\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

옵션세트 코드

 |
| option\_preset\_name | 

연동형 옵션 세트명

상품연동형 옵션을 사용할 경우, 옵션 세트의 이름 입력

 |
| use\_additional\_option | 

추가입력 옵션 사용여부

T : 사용함  
F : 사용안함

 |
| additional\_options | 

추가입력 옵션

 |
| 

additional\_options 하위 요소 보기

**additional\_option\_name**  
**Required**  
추가입력옵션명

**additional\_option\_text\_length**  
**Required**  
추가입력옵션 길이제한  
1~30  
50  
100  
200

**required\_additional\_option**  
**Required**  
추가입력옵션 필수 여부  
T : 필수  
F : 선택  
DEFAULT T







 |
| use\_attached\_file\_option | 

파일 첨부 옵션 사용여부

T : 사용함  
F : 사용안함

 |
| attached\_file\_option | 

파일 첨부 옵션

 |

Create product options

*   [Create product options](#none)
*   [Create combination type option of the product](#none)
*   [Create linked with product option of the product with creating new option preset](#none)
*   [Create linked with product option of the product with existing option preset](#none)
*   [Create independently selectable option of the product](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update product options [](#update-product-options)cafe24 youtube

PUT /api/v2/admin/products/{product\_no}/options

###### PUT

상품의 옵션을 수정할 수 있습니다.  
옵션명과 옵션값, 추가입력 옵션과 파일첨부 옵션의 수정만 가능하며, 옵션 항목을 추가하거나 삭제할 수는 없습니다.  
또한 생성되어 있는 품목은 초기화하지 않습니다.  
옵션을 추가하거나 삭제하고 싶을 경우에는 옵션 삭제 API(Delete a products option)로 삭제하신 후, 다시 등록하시면 됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| option\_list\_type | 

옵션 표시방식

조합형 옵션을 사용할 경우, 조합형 옵션의 유형 입력  
  
\* 조합 일체선택형 : 하나의 셀렉스박스(버튼 이나 라디오버튼)에 모든 옵션이 조합되어 표시됨  
\* 조합 분리선택형 : 옵션을 각각의 셀렉스박스(버튼 이나 라디오버튼)로 선택할 수 있으며 옵션명을 기준으로 옵션값을 조합할 수 있음  
  
독립형이나 상품 연동형 옵션을 사용하고 있을 경우 S(분리형)로 입력됨.

S : 조합 분리선택형  
C : 조합 일체선택형

 |
| option\_preset\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

옵션세트 코드

상품연동형 옵션을 사용할 경우, 옵션 세트 코드 입력

 |
| options | 

옵션

 |
| 

options 하위 요소 보기

**option\_name**  
**Required**  
옵션명

**option\_value** _Array_

option\_value 하위 요소 보기

**option\_text**  
옵션값  
**Required**

**option\_image\_file**  
옵션 버튼 이미지

**option\_link\_image**  
옵션 연결 이미지

**option\_color**  
컬러칩 색상

**option\_display\_type**  
옵션 표시방식  
S : 셀렉트박스  
P : 미리보기  
B : 텍스트버튼  
R : 라디오버튼  
DEFAULT S







 |
| original\_options | 

수정되기전 옵션값

 |
| 

original\_options 하위 요소 보기

**option\_name**  
**Required**  
옵션명

**option\_value** _Array_

option\_value 하위 요소 보기

**option\_text**  
옵션값  
**Required**













 |
| select\_one\_by\_option | 

옵션별로 한 개씩 선택 (독립형 옵션)

독립형 옵션을 사용할 경우, 하나의 옵션을 여러개 중복하여 선택할 수 없고 한개씩만 선택 가능함.

T : 사용함  
F : 사용안함 독립형에만 존재 체크시 옵션별로 한개씩 선택 값 처리

 |
| option\_preset\_name | 

연동형 옵션 세트명

상품연동형 옵션을 사용할 경우, 옵션 세트의 이름 입력

 |
| use\_additional\_option | 

추가입력 옵션 사용여부

T : 사용함  
F : 사용안함

 |
| additional\_options | 

추가입력 옵션

 |
| 

additional\_options 하위 요소 보기

**additional\_option\_name**  
**Required**  
추가입력옵션명

**additional\_option\_text\_length**  
**Required**  
추가입력옵션 길이제한  
1~30  
50  
100  
200

**required\_additional\_option**  
**Required**  
추가입력옵션 필수 여부  
T : 필수  
F : 선택  
DEFAULT T







 |
| use\_attached\_file\_option | 

파일 첨부 옵션 사용여부

T : 사용함  
F : 사용안함

 |
| attached\_file\_option | 

파일 첨부 옵션

 |

Update product options

*   [Update product options](#none)
*   [Update option name and option value](#none)
*   [Update option name and option value of linked with product option](#none)
*   [Update option name, option value and required option of independetly selectable option](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a product option [](#delete-a-product-option)cafe24 youtube

DELETE /api/v2/admin/products/{product\_no}/options

###### DELETE

상품의 옵션을 삭제할 수 있습니다.  
옵션을 삭제하면 옵션 기능이 '사용안함' 상태가 되기 때문에 기존에 생성되어 있던 품목도 함께 삭제되므로 주의가 필요합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **product\_no**  
**Required** | 
상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |

Delete a product option

*   [Delete a product option](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products seo

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20seo.png)  
  
상품 SEO(Products seo)는 특정 상품의 SEO 에 대한 설정과 설정값의 조회가 가능한 기능입니다.  
SEO는 검색엔진 최적화(Search Engine Optimization)의 약자로서 본 기능을 활용하여 검색엔진에 상품이나 쇼핑몰이 더 잘 검색될 수 있도록 할 수 있습니다.  
상품 SEO는 상품의 하위 리소스로서 특정 상품의 검색엔진 최적화 설정을 할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/products/{product_no}/seo
PUT /api/v2/admin/products/{product_no}/seo
```

#### \[더보기 상세 내용\]

### Products seo property list[](#products__seo-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| meta\_title | 

브라우저 타이틀

해당 상품의 상품 상세 페이지의 Title 태그에 표시되는 정보. Title 태그는 브라우저에 표시되는 정보로 검색엔진에서 검색시 가장 기본적인 정보이다.

 |
| meta\_author | 

메타태그1 : Author

해당 상품의 상품 상세 페이지의  태그에 표시되는 정보. author 메타 태그에는 해당 상품을 제조한 사람 또는 등록한 사람을 기입한다.

 |
| meta\_description | 

메타태그2 : Description

해당 상품의 상품 상세 페이지의  태그에 표시되는 정보. description 태그에 검색 결과 페이지에서 검색 결과 아래에 표시될 간략한 정보를 입력할 수 있다.

 |
| meta\_keywords | 

메타태그3 : Keywords

해당 상품의 상품 상세 페이지의  태그에 표시되는 정보. keyword 태그에 해당 상품이 검색되었으면 하는 검색 키워드를 입력할 수 있다.

 |
| meta\_alt | 

상품 이미지 Alt 텍스트

상품 이미지에 표시되는 Alt 텍스트 정보. Alt 텍스트를 입력해놓으면 검색엔진에서 이미지 검색시 검색될 가능성이 높아지며, 브라우저에서 이미지 대신 해당 텍스트를 출력할 수 있어 웹 접근성에도 유리하다.

 |
| search\_engine\_exposure | 

검색 엔진 노출 설정

해당 상품을 검색엔진에 노출할 것인지 설정. '노출안함'으로 설정할 경우 해당 상품이 검색엔진에 노출되지 않는다.

T : 사용함  
F : 사용안함

 |

### Retrieve a product's SEO settings [](#retrieve-a-product-s-seo-settings)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/seo

###### GET

특정 상품의 SEO 설정을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |

Retrieve a product's SEO settings

*   [Retrieve a product's SEO settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update product SEO settings [](#update-product-seo-settings)cafe24 youtube

PUT /api/v2/admin/products/{product\_no}/seo

###### PUT

특정 상품의 SEO 설정을 수정할 수 있습니다.  
브라우저 타이틀, 메타태그, 검색엔진 노출 설정 등을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| meta\_title | 

브라우저 타이틀

해당 상품의 상품 상세 페이지의 Title 태그에 표시되는 정보. Title 태그는 브라우저에 표시되는 정보로 검색엔진에서 검색시 가장 기본적인 정보이다.

 |
| meta\_author | 

메타태그1 : Author

해당 상품의 상품 상세 페이지의  태그에 표시되는 정보. author 메타 태그에는 해당 상품을 제조한 사람 또는 등록한 사람을 기입한다.

 |
| meta\_description | 

메타태그2 : Description

해당 상품의 상품 상세 페이지의  태그에 표시되는 정보. description 태그에 검색 결과 페이지에서 검색 결과 아래에 표시될 간략한 정보를 입력할 수 있다.

 |
| meta\_keywords | 

메타태그3 : Keywords

해당 상품의 상품 상세 페이지의  태그에 표시되는 정보. keyword 태그에 해당 상품이 검색되었으면 하는 검색 키워드를 입력할 수 있다.

 |
| meta\_alt | 

상품 이미지 Alt 텍스트

상품 이미지에 표시되는 Alt 텍스트 정보. Alt 텍스트를 입력해놓으면 검색엔진에서 이미지 검색시 검색될 가능성이 높아지며, 브라우저에서 이미지 대신 해당 텍스트를 출력할 수 있어 웹 접근성에도 유리하다.

 |
| search\_engine\_exposure | 

검색 엔진 노출 설정

해당 상품을 검색엔진에 노출할 것인지 설정. '노출안함'으로 설정할 경우 해당 상품이 검색엔진에 노출되지 않는다.

 |

Update product SEO settings

*   [Update product SEO settings](#none)
*   [Update the product's search engine exposure to hidden](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products tags

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20tags.png)  
  
상품 태그(Products tags)는 상품이 특정 단어로 검색 되어야할 경우 추가할 수 있는 검색 키워드와 관련된 기능입니다.  
상품 태그는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.  
상품명이나 상품 상세 설명 외에 다른 단어로도 상품이 검색되길 원할 경우 검색어를 상품에 추가할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/products/{product_no}/tags/count
GET /api/v2/admin/products/{product_no}/tags
POST /api/v2/admin/products/{product_no}/tags
DELETE /api/v2/admin/products/{product_no}/tags/{tag}
```

#### \[더보기 상세 내용\]

### Products tags property list[](#products__tags-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| **tags**  
**Required** | 

상품 태그

 |
| product\_no | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| tag | 

상품 태그

검색 또는 분류를 위하여 상품에 입력하는 검색어 정보(해시태그)

 |

### Retrieve a count of a product's product tags [](#retrieve-a-count-of-a-product-s-product-tags)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/tags/count

###### GET

특정 상품에 등록된 상품 태그의 수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |

Retrieve a count of a product's product tags

*   [Retrieve a count of a product's product tags](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a list of a product's product tags [](#retrieve-a-list-of-a-product-s-product-tags)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/tags

###### GET

상품에 등록된 태그를 목록으로 조회할 수 있습니다.  
상품 태그, 상품번호 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |

Retrieve a list of a product's product tags

*   [Retrieve a list of a product's product tags](#none)
*   [Retrieve tags with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create product tags [](#create-product-tags)cafe24 youtube

POST /api/v2/admin/products/{product\_no}/tags

###### POST

특정 상품에 검색 또는 분류를 위한 상품 태그를 등록할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| shop\_no | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| **tags**  
**Required**  

_배열 최대사이즈: \[100\]_

 | 

상품 태그

쇼핑 큐레이션 사용 시 - 배열 최대사이즈 : \[100\]

 |

Create product tags

*   [Create product tags](#none)
*   [Post a product tag](#none)
*   [Try posting a product tag without tags field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a product tag [](#delete-a-product-tag)cafe24 youtube

DELETE /api/v2/admin/products/{product\_no}/tags/{tag}

###### DELETE

특정 상품에 등록된 특정 태그를 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| tag | 

상품 태그

검색 또는 분류를 위하여 상품에 입력하는 검색어 정보(해시태그)

 |

Delete a product tag

*   [Delete a product tag](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products variants

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20variants.png)  
  
상품의 품목(Products variants)은 쇼핑몰에서 판매되는 상품의 기본 단위입니다.  
쇼핑몰은 일반적으로 고객에게 다양한 선택권을 제공하기 위해 같은 상품이지만 사이즈가 다르거나, 혹은 색상이 다른 품목들을 판매합니다.  
품목의 조회, 등록, 수정 또는 삭제를 할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/products/{product_no}/variants
GET /api/v2/admin/products/{product_no}/variants/{variant_code}
PUT /api/v2/admin/products/{product_no}/variants/{variant_code}
PUT /api/v2/admin/products/{product_no}/variants
DELETE /api/v2/admin/products/{product_no}/variants/{variant_code}
```

#### \[더보기 상세 내용\]

### Products variants property list[](#products__variants-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| variant\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

상품 품목 코드

시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않음.

 |
| options | 

옵션

 |
| custom\_variant\_code  

_최대글자수 : \[40자\]_

 | 

자체 품목 코드

사용자가 품목에 부여 가능한 코드. 재고 관리 등의 이유로 자체적으로 상품을 관리하고 있는 경우 사용함.

 |
| display | 

진열상태

해당 품목을 진열할지 여부. 품목을 진열할 경우 상품 상세 또는 상품 목록에서 해당 품목을 선택할 수 있다. 품목이 진열되어있지 않을 경우 해당 품목이 표시되지 않으며 해당 품목을 구매할 수 없다.

T : 판매함  
F : 판매안함

 |
| selling | 

판매상태

해당 품목을 판매할지 여부. 진열은 되어있으나 판매는 하지 않을 경우 해당 품목은 "품절"로 표시되며 해당 품목을 구매할 수 없다. 품목이 "판매함" 상태여도 "진열안함"으로 되어있다면 해당 품목을 구매할 수 없다.

T : 진열함  
F : 진열안함

 |
| display\_order  

_최소: \[1\]~최대: \[300\]_

 | 

진열 순서

 |
| additional\_amount | 

추가금액

해당 품목을 구매할 경우, 상품의 판매가에 더하여 지불해야하는 추가 가격.

 |
| use\_inventory | 

재고 사용여부

T : 사용함  
F : 사용안함

 |
| important\_inventory | 

중요재고 여부

A : 일반재고  
B : 중요재고

 |
| inventory\_control\_type | 

재고 수량체크 기준

A : 주문기준  
B : 결제기준

 |
| display\_soldout | 

품절표시여부

T : 품절표시 사용  
F : 품절표시 사용안함

 |
| quantity | 

수량

 |
| safety\_inventory | 

안전재고수량

 |
| image | 

품목 이미지

 |
| inventories | 

재고 리소스

품목의 재고 리소스

 |
| duplicated\_custom\_variant\_code | 

자체품목코드 중복여부

T : 중복됨  
F : 중복안됨

 |
| product\_no | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |

### Retrieve a list of product variants [](#retrieve-a-list-of-product-variants)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/variants

###### GET

상품의 품목을 목록으로 조회할 수 있습니다.  
상품 품목 코드, 진열상태, 판매상태 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| inventories  
**embed** | 

재고 리소스

품목의 재고 리소스  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

,(콤마)로 여러 건을 검색할 수 있다.

 |

Retrieve a list of product variants

*   [Retrieve a list of product variants](#none)
*   [Retrieve variants with embed parameter](#none)
*   [Retrieve variants with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a product variant [](#retrieve-a-product-variant)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/variants/{variant\_code}

###### GET

상품의 특정 품목을 조회할 수 있습니다.  
옵션정보, 자체 품목 코드, 진열 및 판매상태 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| **variant\_code**  
**Required**  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

품목코드

 |
| inventories  
**embed** | 

재고 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |

Retrieve a product variant

*   [Retrieve a product variant](#none)
*   [Retrieve a product variant with fields parameter](#none)
*   [Retrieve a product variant with embed](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a product variant [](#update-a-product-variant)cafe24 youtube

PUT /api/v2/admin/products/{product\_no}/variants/{variant\_code}

###### PUT

상품의 특정 품목을 수정할 수 있습니다.  
자체 품목 코드, 진열상태, 판매상태, 추가금액 등을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| **variant\_code**  
**Required**  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

상품 품목 코드

시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않음.

 |
| custom\_variant\_code  

_최대글자수 : \[40자\]_

 | 

자체 품목 코드

**Youtube shopping 이용 시에는 미제공**

사용자가 품목에 부여 가능한 코드. 재고 관리 등의 이유로 자체적으로 상품을 관리하고 있는 경우 사용함.

 |
| display | 

진열상태

**Youtube shopping 이용 시에는 미제공**

해당 품목을 진열할지 여부. 품목을 진열할 경우 상품 상세 또는 상품 목록에서 해당 품목을 선택할 수 있다. 품목이 진열되어있지 않을 경우 해당 품목이 표시되지 않으며 해당 품목을 구매할 수 없다.

T : 진열함  
F : 진열안함

 |
| selling | 

판매상태

해당 품목을 판매할지 여부. 진열은 되어있으나 판매는 하지 않을 경우 해당 품목은 "품절"로 표시되며 해당 품목을 구매할 수 없다. 품목이 "판매함" 상태여도 "진열안함"으로 되어있다면 해당 품목을 구매할 수 없다.

T : 판매함  
F : 판매안함

 |
| display\_order  

_최소: \[1\]~최대: \[300\]_

 | 

진열 순서

조합형 옵션 품목에 대해서만 사용 가능함

 |
| additional\_amount  

_최소: \[-2147483647\]~최대: \[2147483647\]_

 | 

추가금액

해당 품목을 구매할 경우, 상품의 판매가에 더하여 지불해야하는 추가 가격.

 |
| quantity | 

수량

 |
| use\_inventory | 

재고 사용여부

T : 사용함  
F : 사용안함

 |
| important\_inventory | 

중요재고 여부

**Youtube shopping 이용 시에는 미제공**

A : 일반재고  
B : 중요재고

 |
| inventory\_control\_type | 

재고 수량체크 기준

A : 주문기준  
B : 결제기준

 |
| display\_soldout | 

품절표시여부

T : 품절표시 사용  
F : 품절표시 사용안함

 |
| safety\_inventory | 

안전재고수량

**Youtube shopping 이용 시에는 미제공**

 |

Update a product variant

*   [Update a product variant](#none)
*   [Update a variant of the product to public](#none)
*   [Update a variant of the product to sold out](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update multiple product variants [](#update-multiple-product-variants)cafe24 youtube

PUT /api/v2/admin/products/{product\_no}/variants

###### PUT

상품의 여러 품목을 한번에 수정할 수 있습니다.  
품목의 진열상태, 판매상태, 재고 사용여부 등을 변경할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |
| **variant\_code**  
**Required**  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

상품 품목 코드

 |
| custom\_variant\_code  

_최대글자수 : \[40자\]_

 | 

자체 품목 코드

 |
| display | 

진열상태

T : 진열함  
F : 진열안함

 |
| selling | 

판매상태

T : 판매함  
F : 판매안함

 |
| display\_order  

_최소: \[1\]~최대: \[300\]_

 | 

진열 순서

조합형 옵션 품목에 대해서만 사용 가능함

 |
| additional\_amount  

_최소: \[-2147483647\]~최대: \[2147483647\]_

 | 

추가금액

 |
| quantity | 

수량

 |
| use\_inventory | 

재고 사용여부

T : 사용함  
F : 사용안함

 |
| important\_inventory | 

중요재고 여부

A : 일반재고  
B : 중요재고

 |
| inventory\_control\_type | 

재고 수량체크 기준

A : 주문기준  
B : 결제기준

 |
| display\_soldout | 

품절표시여부

T : 품절표시 사용  
F : 품절표시 사용안함

 |
| safety\_inventory | 

안전재고수량

 |

Update multiple product variants

*   [Update multiple product variants](#none)
*   [Update multiple variants of the product to public](#none)
*   [Update multiple variants of the product to sold out](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a product variant [](#delete-a-product-variant)cafe24 youtube

DELETE /api/v2/admin/products/{product\_no}/variants/{variant\_code}

###### DELETE

상품의 특정 품목을 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **product\_no**  
**Required** | 
상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| **variant\_code**  
**Required**  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

상품 품목 코드

시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않음.

 |

Delete a product variant

*   [Delete a product variant](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products variants inventories

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Products%20variants%20inventories.png)  
  
재고(Inventories)는 판매 가능한 해당 품목의 수량을 의미합니다. 재고는 품목(Variants)별로 존재하며 해당 재고 이상 품목이 판매되면 해당 상품은 품절 상태가 됩니다.

> Endpoints

```
GET /api/v2/admin/products/{product_no}/variants/{variant_code}/inventories
PUT /api/v2/admin/products/{product_no}/variants/{variant_code}/inventories
```

#### \[더보기 상세 내용\]

### Products variants inventories property list[](#products__variants__inventories-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| variant\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

품목코드

시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않는다.

 |
| use\_inventory | 

재고 사용여부

해당 품목에서 재고 관리를 사용할 것인지 여부. 해당 품목에 재고 관리를 사용할 경우 재고 수량을 입력할 수 있다. 재고 관리를 사용하지 않을 경우 해당 상품은 재고와 관계 없이 판매할 수 있으며, 재고 수량, 재고수량 체크 기준, 품절 표시 여부를 사용할 수 없다.

T : 사용함  
F : 사용안함

 |
| important\_inventory | 

중요재고 여부

해당 재고를 중요하게 관리하는지 여부. 쇼핑몰에서는 검색을 하기위한 구분 데이터로 사용한다.

A : 일반재고  
B : 중요재고

 |
| inventory\_control\_type | 

재고 수량체크 기준

재고 수량을 어느 시점에 차감할 것인지 여부. 무통장 입금처럼 결제 시점과 주문 시점이 다른 경우 재고를 차감하는 기준을 다르게 설정할 수 있다.  
  
주문 기준 : 주문한 시점에 재고 차감. 무통장 입금의 경우 입금 완료가 되지 않아도 재고를 차감한다.  
결제 기준 : 결제한 시점에 재고 차감. 무통장 입금의 경우 입금 완료가 된 다음 재고를 차감한다.

A : 주문기준  
B : 결제기준

 |
| display\_soldout | 

품절표시여부

재고가 다 판매되었을 경우 해당 품목을 품절로 표시할 것인지 여부. 품절로 표시되면 주문을 할 수 없다. 모든 품목이 품절이 될 경우 해당 상품에 품절 아이콘이 표시된다.  
"표시안함" 선택시 재고가 다 판매되어도 주문이 가능하며 재고가 마이너스(-)로 표기된다.

T : 품절표시 사용  
F : 품절표시 사용안함

 |
| quantity | 

수량

해당 품목에 판매가 가능한 재고 수량. 재고 수량은 주문 또는 결제시 차감되며, 품절 표시를 위하여 체크된다.

 |
| safety\_inventory | 

안전재고수량

 |
| origin\_code | 

출고지 코드

 |

### Retrieve inventory details of a product variant [](#retrieve-inventory-details-of-a-product-variant)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/variants/{variant\_code}/inventories

###### GET

상품의 품목의 재고를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| **variant\_code**  
**Required**  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

품목코드

판매 수량을 검색할 품목 코드

 |

Retrieve inventory details of a product variant

*   [Retrieve inventory details of a product variant](#none)
*   [Retrieve inventories with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a product variant inventory [](#update-a-product-variant-inventory)cafe24 youtube

PUT /api/v2/admin/products/{product\_no}/variants/{variant\_code}/inventories

###### PUT

상품의 품목의 재고에 관한 정보를 수정할 수 있습니다.  
재고 관리의 사용여부, 중요재고의 여부, 안전재고 설정, 재고수량 수정 등을 할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| **variant\_code**  
**Required**  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

품목코드

시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않는다.

 |
| use\_inventory | 

재고 사용여부

해당 품목에서 재고 관리를 사용할 것인지 여부. 해당 품목에 재고 관리를 사용할 경우 재고 수량을 입력할 수 있다. 재고 관리를 사용하지 않을 경우 해당 상품은 재고와 관계 없이 판매할 수 있으며, 재고 수량, 재고수량 체크 기준, 품절 표시 여부를 사용할 수 없다.

T : 사용함  
F : 사용안함

 |
| important\_inventory | 

중요재고 여부

해당 재고를 중요하게 관리하는지 여부. 쇼핑몰에서는 검색을 하기위한 구분 데이터로 사용한다.

A : 일반재고  
B : 중요재고

 |
| inventory\_control\_type | 

재고 수량체크 기준

재고 수량을 어느 시점에 차감할 것인지 여부. 무통장 입금처럼 결제 시점과 주문 시점이 다른 경우 재고를 차감하는 기준을 다르게 설정할 수 있다.  
  
주문 기준 : 주문한 시점에 재고 차감. 무통장 입금의 경우 입금 완료가 되지 않아도 재고를 차감한다.  
결제 기준 : 결제한 시점에 재고 차감. 무통장 입금의 경우 입금 완료가 된 다음 재고를 차감한다.

A : 주문기준  
B : 결제기준

 |
| display\_soldout | 

품절표시여부

재고가 다 판매되었을 경우 해당 품목을 품절로 표시할 것인지 여부. 품절로 표시되면 주문을 할 수 없다. 모든 품목이 품절이 될 경우 해당 상품에 품절 아이콘이 표시된다.  
"표시안함" 선택시 재고가 다 판매되어도 주문이 가능하며 재고가 마이너스(-)로 표기된다.

T : 품절표시 사용  
F : 품절표시 사용안함

 |
| quantity | 

수량

해당 품목에 판매가 가능한 재고 수량. 재고 수량은 주문 또는 결제시 차감되며, 품절 표시를 위하여 체크된다.

 |
| safety\_inventory | 

안전재고수량

 |
| origin\_code | 

출고지 코드

 |

Update a product variant inventory

*   [Update a product variant inventory](#none)
*   [Update inventoies of the variant to sold out](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products customproperties

상품에 등록된 사용자정의 속성을 관리 기능을 제공합니다.

> Endpoints

```
GET /api/v2/admin/products/customproperties
POST /api/v2/admin/products/customproperties
PUT /api/v2/admin/products/customproperties/{property_no}
DELETE /api/v2/admin/products/customproperties/{property_no}
```

#### \[더보기 상세 내용\]

### Products customproperties property list[](#products-customproperties-property-list)

| **Attribute** | **Description** |
| --- | --- |
| custom\_properties | 
자체 정의 속성

 |

### Retrieve user-defined properties [](#retrieve-user-defined-properties)cafe24 youtube

GET /api/v2/admin/products/customproperties

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |

Retrieve user-defined properties

*   [Retrieve user-defined properties](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create user-defined properties [](#create-user-defined-properties)cafe24 youtube

POST /api/v2/admin/products/customproperties

###### POST

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| custom\_properties | 
자체 정의 속성

 |
| 

custom\_properties 하위 요소 보기

**property\_name**  
**Required**  
자체 정의 속성 이름







 |

Create user-defined properties

*   [Create user-defined properties](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update user-defined properties [](#update-user-defined-properties)cafe24 youtube

PUT /api/v2/admin/products/customproperties/{property\_no}

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **property\_no**  
**Required** | 
자체 정의 속성 번호

 |
| **property\_name**  
**Required**  

_최대글자수 : \[250자\]_

 | 

자체 정의 속성 이름

 |

Update user-defined properties

*   [Update user-defined properties](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete user-defined properties [](#delete-user-defined-properties)cafe24 youtube

DELETE /api/v2/admin/products/customproperties/{property\_no}

###### DELETE

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **property\_no**  
**Required** | 
자체 정의 속성 번호

 |

Delete user-defined properties

*   [Delete user-defined properties](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products decorationimages

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20decorationimages.png)  
  
꾸미기 이미지(Decorationimages)는 쇼핑몰에 진열된 상품 이미지 위에 추가하여 상품에 포인트를 줄 수 있는 기능입니다.  
쇼핑몰에 등록되어있는 꾸미기 이미지를 조회하여 상품별로 꾸미기 이미지를 지정하거나, 상품에 등록되어있는 꾸미기 이미지를 조회할 수 있습니다.  
꾸미기 이미지는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/products/decorationimages
```

#### \[더보기 상세 내용\]

### Products decorationimages property list[](#products-decorationimages-property-list)

| **Attribute** | **Description** |
| --- | --- |
| code | 
꾸미기 이미지 코드

 |
| path | 

꾸미기 이미지 URL

 |

### Retrieve a list of decoration images [](#retrieve-a-list-of-decoration-images)cafe24 youtube

GET /api/v2/admin/products/decorationimages

###### GET

쇼핑몰에 등록되어있는 꾸미기 이미지를 목록으로 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

Retrieve a list of decoration images

*   [Retrieve a list of decoration images](#none)
*   [Retrieve decorationimages with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products icons

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20icons.png)  
  
상품 아이콘은 상품을 강조하기 위해 상품 옆에 추가할 수 있는 작은 이미지들입니다. 진열된 상품에 할인 정보, "매진 임박" 등의 메시지를 추가하여 상품을 강조할 수 있습니다.  
상품 아이콘는 하위 리소스로서 상품(Products) 하위에서만 사용할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/products/icons
```

#### \[더보기 상세 내용\]

### Products icons property list[](#products-icons-property-list)

| **Attribute** | **Description** |
| --- | --- |
| code | 
아이콘 코드

 |
| path | 

아이콘 URL

 |

### Retrieve a list of icons [](#retrieve-a-list-of-icons)cafe24 youtube

GET /api/v2/admin/products/icons

###### GET

상품에 등록된 모든 아이콘을 조회할 수 있습니다.  
현재 특정 상품에 어떤 아이콘들이 등록되어 있는지 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

Retrieve a list of icons

*   [Retrieve a list of icons](#none)
*   [Retrieve icons with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products images

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Product%20images.png)  
  
상품 이미지(Products Images)는 상품의 판매를 위해서 업로드한 상품의 사진이나 그림을 의미합니다.  
상품 이미지 API를 사용해 상품 상세설명에서 사용할 이미지를 업로드하거나, 상품의 이미지를 업로드할 수 있습니다.  
상품의 이미지는 Base64 코드 로 인코딩하여 업로드할 수 있습니다

> Endpoints

```
POST /api/v2/admin/products/images
```

#### \[더보기 상세 내용\]

### Products images property list[](#products-images-property-list)

| **Attribute** | **Description** |
| --- | --- |
| path | 
상세이미지

 |

### Upload images [](#upload-images)cafe24

POST /api/v2/admin/products/images

###### POST

이미지를 업로드할 수 있습니다.  
상품에 이미지를 등록하기 위해서는 이미지를 먼저 업로드해야 합니다.  
상품의 이미지는 Base64 코드 로 인코딩하여 업로드할 수 있습니다

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **20** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **image**  
**Required** | 
상세이미지

● 이미지 파일 용량 제한 : 10MB  
● 한 호출당 이미지 전체 용량 제한 : 30MB

 |

Upload images

*   [Upload images](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products properties

상품 상세 화면에 표시되는 항목을 조회하고 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/products/properties
POST /api/v2/admin/products/properties
PUT /api/v2/admin/products/properties
```

#### \[더보기 상세 내용\]

### Products properties property list[](#products-properties-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| properties | 

항목 속성

 |
| property | 

항목 속성

 |

### Retrieve fields for product details [](#retrieve-fields-for-product-details)cafe24

GET /api/v2/admin/products/properties

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 읽기권한 (mall.read\_product)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve fields for product details

*   [Retrieve fields for product details](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a field for product details page [](#create-a-field-for-product-details-page)cafe24

POST /api/v2/admin/products/properties

###### POST

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| property | 
항목 속성

 |
| 

property 하위 요소 보기

**multishop\_display\_names** _Array_

multishop\_display\_names 하위 요소 보기

**shop\_no**  
멀티쇼핑몰 번호  
**Required**

**name**  
항목명 표시텍스트  
**Required**

**display**  
항목 표시여부  
DEFAULT F

**display\_name**  
항목명 표시설정  
T : 사용함  
F : 사용안함  
DEFAULT T

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)  
DEFAULT N

**font\_size**  
글자 크기  
DEFAULT 12

**font\_color**  
글자 색상  
DEFAULT #555555

**exposure\_group\_type**  
표시 대상 타입  
A: 전체  
M: 회원  
DEFAULT A







 |

Create a field for product details page

*   [Create a field for product details page](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update fields for product details [](#update-fields-for-product-details)cafe24

PUT /api/v2/admin/products/properties

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품 쓰기권한 (mall.write\_product)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| properties | 

항목 속성

 |
| 

properties 하위 요소 보기

**key**  
**Required**  
항목코드

**name**  
항목명 표시텍스트

**display**  
항목 표시여부

**font\_type**  
글자 타입  
N : 보통(Normal)  
B : 굵게(Bold)  
I : 기울임(Italic)  
D : 굵게 기울임(Bold Italic)

**font\_size**  
글자 크기

**font\_color**  
글자 색상







 |

Update fields for product details

*   [Update fields for product details](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Order

## Cancellation

취소(Cancellation)는 특정 주문을 배송 전에 취소하는 기능입니다.  
판매자가 접수한 이후부터 생성되며 취소처리중의 단계를 거쳐 취소완료까지 진행됩니다.  
취소 리소스에서는 복수의 주문을 한번에 취소하거나 취소 상태를 수정하거나 조회할 수 있습니다.  
특정 주문을 취소할 때와 달리 PG 취소까지 진행되도록 취소할 수는 없습니다.

> Endpoints

```
GET /api/v2/admin/cancellation/{claim_code}
POST /api/v2/admin/cancellation
PUT /api/v2/admin/cancellation
```

#### \[더보기 상세 내용\]

### Cancellation property list[](#cancellation-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| claim\_code | 

취소번호

 |
| claim\_reason\_type | 

구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| claim\_reason | 

사유

 |
| refund\_methods | 

환불 방식

 |
| refund\_reason | 

비고

 |
| order\_price\_amount | 

상품구매금액

 |
| refund\_amounts | 

환불금액

 |
| shipping\_fee | 

배송비

 |
| return\_ship\_type | 

반품배송비 적용구분

 |
| defer\_commission | 

후불 결제 수수료

 |
| partner\_discount\_amount | 

제휴할인 취소액

 |
| add\_discount\_amount | 

상품별추가할인 취소액

 |
| member\_grade\_discount\_amount | 

회원등급할인 취소액

 |
| shipping\_discount\_amount | 

배송비할인 취소액

 |
| coupon\_discount\_amount | 

쿠폰할인 취소액

 |
| point\_used | 

사용된 적립금 반환액

 |
| credit\_used | 

사용된 예치금 반환액

 |
| undone | 

철회 여부

T : 철회함  
F : 철회안함

 |
| undone\_reason\_type | 

철회 사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| undone\_reason | 

철회 사유

 |
| expose\_order\_detail | 

주문상세내역 노출 여부

T : 노출함  
F : 노출안함

 |
| exposed\_undone\_reason | 

주문상세내역 노출 철회 사유

 |
| items | 

품주코드

 |
| include\_tax | 

가격에 세금 포함

T: 세금포함  
F: 세금제외

 |
| tax | 

세금 정보

세금 관리자 앱을 사용 안 할 경우 null로 반환

 |
| cancel\_fee\_amount | 

취소수수료

 |
| status | 

주문상태

canceled : 취소완료  
canceling : 취소처리중

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

 |

### Retrieve an order cancellation [](#retrieve-an-order-cancellation)cafe24 youtube

GET /api/v2/admin/cancellation/{claim\_code}

###### GET

취소 완료되었거나 취소처리 진행중인 내역을 조회할 수 있습니다.  
환불 방식, 환불금액, 철회 사유 구분 등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **claim\_code**  
**Required** | 

취소번호

 |

Retrieve an order cancellation

*   [Retrieve an order cancellation](#none)
*   [Retrieve a cancellation with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create multiple order cancellations [](#create-multiple-order-cancellations)cafe24 youtube

POST /api/v2/admin/cancellation

###### POST

배송 전의 여러 주문을 취소할 수 있습니다.  
해당 API를 사용하여 취소할 경우 환불완료 처리까지는 되지만 PG 취소까지는 진행되지 않으며 별도 PG 취소처리를 해주어야 합니다.  
부분취소할 경우 각 환불 금액은 자동 계산되어 환불처리 됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **status**  
**Required** | 

주문상태

accepted: 취소접수  
canceling : 취소처리중  
canceled : 취소완료

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

DEFAULT F

 |
| recover\_coupon | 

쿠폰 복원

오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가

T : 복구함  
F : 복구안함

DEFAULT F

 |
| recover\_coupon\_no | 

복원할 쿠폰 번호

 |
| add\_memo\_too | 

관리자 메모에도 추가

오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가

T : 사용함  
F : 사용안함

DEFAULT F

 |
| reason  

_최대글자수 : \[2000자\]_

 | 

취소사유

 |
| claim\_reason\_type | 

취소사유 구분

오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가

A : 고객변심  
B : 배송지연  
C : 배송불가지역  
L : 수출/통관 불가  
D : 포장불량  
E : 상품불만족  
F : 상품정보상이  
G : 서비스불만족  
H : 품절  
I : 기타

 |
| naverpay\_cancel\_reason\_type | 

네이버페이 취소사유 구분

쇼핑몰/오픈마켓/카카오페이 주문을 취소할 경우 사용 불가

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

51 : 구매 의사 취소  
52 : 색상 및 사이즈 변경  
53 : 다른 상품 잘못 주문  
54 : 서비스 및 상품 불만족  
55 : 배송 지연  
56 : 상품 품절  
60 : 상품 정보 상이

 |
| kakaopay\_cancel\_reason\_type | 

카카오페이 취소사유 구분

오픈마켓/네이버페이 주문을 취소할 경우 사용 불가

K1 : 변심에 의한 상품 취소  
K2 : 다른 옵션이나 상품을 잘못 주문함  
K3 : 배송지연  
K4 : 상품 파손 또는 불량  
K5 : 다른 상품 오배송 또는 구성품 누락  
K6 : 상품정보와 다름  
K7 : 품절로 인한 배송 불가

 |
| refund\_method\_code | 

환불 방식

(오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가)

T : 현금  
F : 신용카드  
M : 적립금  
G : 계좌이체  
C : 휴대폰  
D : 예치금  
Z : 후불  
O : 선불금  
V : 편의점  
J : 제휴상품권  
K : 제휴포인트  
I : 기타

 |
| refund\_bank\_code | 

환불 은행 코드

환불 방식(refund\_method)이 현금(T)일 경우 필수  
  
[refund\_bank\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/refund_bank_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)  
  
해당 쇼핑몰이 EC Korea 쇼핑몰일 경우 필수  
환불수단(refund\_method)이 "현금(T)"일 때만 사용 가능  
오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가

 |
| refund\_bank\_name  

_최대글자수 : \[250자\]_

 | 

환불은행명

환불 방식(refund\_method)이 현금(T)일 경우 필수  
  
※ 해당 쇼핑몰이 EC Global 쇼핑몰일 경우 필수  
환불수단(refund\_method)이 "현금(T)"일 때만 사용 가능  
오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가

 |
| refund\_bank\_account\_no | 

환불 계좌번호

환불수단(refund\_method)이 "현금(T)"일 때만 사용 가능  
오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가

 |
| refund\_bank\_account\_holder  

_최대글자수 : \[15자\]_

 | 

환불계좌 예금주 명의

 |
| items | 

품주코드

 |
| 

items 하위 요소 보기

**order\_item\_code**  
**Required**  
품주코드

**quantity**  
**Required**  
수량







 |

Create multiple order cancellations

*   [Create multiple order cancellations](#none)
*   [Cancel mutiple orders](#none)
*   [Try to cancel multiple orders without status parameter](#none)
*   [Cancel specific item of multiple orders](#none)
*   [Cancel multiple orders and refund to card and cash](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Change cancellation details in bulk [](#change-cancellation-details-in-bulk)cafe24 youtube

PUT /api/v2/admin/cancellation

###### PUT

주문의 취소 상태를 수정할 수 있습니다.  
취소가 접수된 주문의 주문 상태를 취소 접수 이전 상태로 철회할 수 있습니다.  
주문의 취소 상태를 수정하여 취소접수를 철회하고 재고를 복구하거나 철회사유를 입력할 수 있습니다.  
택배사에 이미 수거요청이 전달되었으나 수거가 필요하지 않게 될 경우, 택배사에 직접 연락하셔서 수거요청을 취소해주셔야 합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **claim\_code**  
**Required** | 

취소번호

 |
| status | 

주문상태

canceling : 취소처리중

 |
| **recover\_inventory**  
**Required** | 

재고복구

T : 복구함  
F : 복구안함

 |
| undone | 

철회 여부

T : 철회함

 |
| **add\_memo\_too**  
**Required** | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

 |
| undone\_reason\_type | 

철회 사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| undone\_reason  

_최대글자수 : \[2000자\]_

 | 

철회 사유

 |
| expose\_order\_detail | 

주문상세내역 노출 여부

T : 노출함  
F : 노출안함

 |
| exposed\_undone\_reason  

_최대글자수 : \[2000자\]_

 | 

주문상세내역 노출 철회 사유

 |
| refund\_method\_code | 

환불 방식

T : 현금  
F : 신용카드  
M : 적립금  
G : 계좌이체  
C : 휴대폰  
D : 예치금  
Z : 후불  
O : 선불금  
V : 편의점  
J : 제휴상품권  
K : 제휴포인트  
I : 기타

 |
| refund\_bank\_code | 

환불 은행 코드

 |
| refund\_bank\_name  

_최대글자수 : \[250자\]_

 | 

환불은행명

 |
| refund\_bank\_account\_no | 

환불 계좌번호

 |
| refund\_bank\_account\_holder  

_최대글자수 : \[15자\]_

 | 

환불계좌 예금주 명의

 |

Change cancellation details in bulk

*   [Change cancellation details in bulk](#none)
*   [Withdraw the cancenllation(mltiple orders)](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Cancellationrequests

취소요청(Cancellationrequests)은 주문에 대한 취소요청에 관한 기능입니다.  
취소를 요청하거나 취소요청중인 주문을 접수거부 할 수 있습니다.

> Endpoints

```
POST /api/v2/admin/cancellationrequests
PUT /api/v2/admin/cancellationrequests
```

#### \[더보기 상세 내용\]

### Cancellationrequests property list[](#cancellationrequests-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| items | 

품주 목록

 |
| undone | 

접수거부 여부

 |
| order\_item\_code | 

품주코드

 |

### Create a cancellation request for multiple items [](#create-a-cancellation-request-for-multiple-items)cafe24 youtube

POST /api/v2/admin/cancellationrequests

###### POST

취소를 요청할 수 있습니다.  
취소사유와 계좌환불인 경우 환불할 계좌번호를 입력할 수 있습니다.  
,(콤마)로 여러 건을 동시에 취소요청 할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **reason\_type**  
**Required** | 

취소사유 구분

A:고객변심  
B:배송지연  
G:서비스불만족  
I:기타

 |
| **reason**  
**Required**  

_최대글자수 : \[2000자\]_

 | 

취소사유

 |
| refund\_bank\_code | 

환불 은행 코드

환불 방식(refund\_method)이 현금(T)일 경우 필수  
  
[refund\_bank\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/refund_bank_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)  
  
해당 쇼핑몰이 EC Korea 쇼핑몰일 경우 필수  
환불수단(refund\_method)이 "현금(T)"일 때만 사용 가능  
오픈마켓/네이버페이 주문을 취소할 경우 사용 불가

 |
| refund\_bank\_name  

_최대글자수 : \[250자\]_

 | 

환불은행명

 |
| refund\_bank\_account\_no | 

환불 계좌번호

 |
| refund\_bank\_account\_holder  

_최대글자수 : \[15자\]_

 | 

환불계좌 예금주 명의

 |
| items | 

품주 목록

 |
| 

items 하위 요소 보기

**order\_item\_code**  
**Required**  
품주코드

**quantity**  
**Required**  
수량







 |

Create a cancellation request for multiple items

*   [Create a cancellation request for multiple items](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Reject a cancellation request for multiple items [](#reject-a-cancellation-request-for-multiple-items)cafe24 youtube

PUT /api/v2/admin/cancellationrequests

###### PUT

취소가 요청된 주문의 특정 품주들에 대하여 취소요청중인 상태를 변경할 수 있습니다.  
접수거부를 할 수 있고 사유를 입력할 수 있습니다.  
,(콤마)로 여러 건을 동시에 취소요청 할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **order\_item\_code**  
**Required** | 

품주코드

 |
| **undone**  
**Required** | 

접수거부 여부

T : 접수거부함

 |
| reason\_type | 

사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| reason  

_최대글자수 : \[2000자\]_

 | 

사유

 |
| display\_reject\_reason | 

주문상세내역 노출설정

T : 노출함  
F : 노출안함

DEFAULT F

 |
| reject\_reason  

_최대글자수 : \[2000자\]_

 | 

거부 사유

 |

Reject a cancellation request for multiple items

*   [Reject a cancellation request for multiple items](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Cashreceipt

현금영수증(Cashreceipts)은 현금으로 구매 후 구매자가 발급 받을 수 있는 결제 증빙입니다.  
현금영수증 리소스를 통해 현금영수증을 발급하거나 수정할 수 있고, 현재까지 발급된 현금영수증을 조회할 수 있습니다.  
현금영수증은 대한민국에만 있는 제도로, 한국 쇼핑몰에서만 사용할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/cashreceipt
POST /api/v2/admin/cashreceipt
PUT /api/v2/admin/cashreceipt/{cashreceipt_no}
```

#### \[더보기 상세 내용\]

### Cashreceipt property list[](#cashreceipt-property-list)

| **Attribute** | **Description** |
| --- | --- |
| cashreceipt\_no | 
현금영수증 번호

 |
| approval\_no | 

승인번호

 |
| request\_date | 

신청일자

 |
| order\_id | 

주문번호

 |
| member\_id | 

회원아이디

 |
| name | 

요청자 이름

 |
| order\_price\_amount | 

상품구매금액

 |
| vat | 

부가세

 |
| subtotal | 

총 신청금액

 |
| order\_status | 

주문상태

입금전: unpaid  
미배송: unshipped  
배송중: shipping  
배송대기: standby  
배송완료: shipped  
부분취소: partially\_canceled  
전체취소: canceled

 |
| status | 

처리상태

신청: request  
발행대기: await\_issuance  
발행: issued  
발행거부: issuance\_rejected  
신청취소: canceled\_request  
발행취소: canceled\_issuance  
발행실패: failed\_issuance

 |
| pg\_name | 

신청결제사

 |
| cash\_bill\_no | 

현금영수증 일련 번호

 |
| partner\_id | 

PG사 발급 가맹점 ID

 |
| type | 

발행 타입

개인: personal  
사업자: business

 |
| company\_registration\_no | 

사업자등록번호

 |
| cellphone | 

휴대전화

 |
| tax\_amount | 

과세금액

 |
| tax\_free\_amount | 

면세금액

 |
| supply\_price | 

공급가액

 |

### Retrieve a list of cash receipts [](#retrieve-a-list-of-cash-receipts)cafe24

GET /api/v2/admin/cashreceipt

###### GET

현재까지 발급된 현금영수증을 조회할 수 있습니다.  
해당 API는 한국어 쇼핑몰에서만 사용 가능합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **start\_date**  
**Required**  
_날짜_

 | 

검색 시작일

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

 |
| order\_id  

_주문번호_

 | 

주문번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| approval\_no  

_최대글자수 : \[9자\]_

 | 

승인번호

 |
| name  

_최대글자수 : \[20자\]_

 | 

요청자 이름

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| status | 

처리상태

전체: all  
신청: request  
발행: issued  
신청취소: canceled\_request  
발행취소: canceled\_issuance  
발행실패: failed\_issuance

DEFAULT all

 |
| limit  

_최소: \[1\]~최대: \[500\]_

 | 

조회결과 최대건수

DEFAULT 10

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a list of cash receipts

*   [Retrieve a list of cash receipts](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a cash receipt [](#create-a-cash-receipt)cafe24

POST /api/v2/admin/cashreceipt

###### POST

특정 주문 번호에 대해 현금영수증을 발급해줄 수 있습니다.  
해당 API는 한국어 쇼핑몰에서만 사용 가능합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **order\_id**  
**Required**  
_주문번호_

 | 

주문번호

 |
| **type**  
**Required** | 

발행 타입

개인: personal  
사업자: business

 |
| company\_registration\_no  

_사업자번호_  
_최대글자수 : \[10자\]_

 | 

사업자등록번호

 |
| cellphone  

_모바일_  
_최대글자수 : \[11자\]_

 | 

휴대전화

 |

Create a cash receipt

*   [Create a cash receipt](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a cash receipt [](#update-a-cash-receipt)cafe24

PUT /api/v2/admin/cashreceipt/{cashreceipt\_no}

###### PUT

발급된 현금 영수증 정보를 수정할 수 있습니다.  
해당 API는 한국어 쇼핑몰에서만 사용 가능합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **cashreceipt\_no**  
**Required**  
_최소값: \[1\]_

 | 

현금영수증 번호

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| type | 

발행 타입

개인: personal  
사업자: business

 |
| company\_registration\_no  

_사업자번호_  
_최대글자수 : \[10자\]_

 | 

사업자등록번호

 |
| cellphone  

_모바일_  
_최대글자수 : \[11자\]_

 | 

휴대전화

 |

Update a cash receipt

*   [Update a cash receipt](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Cashreceipt cancellation

현금영수증 취소(Cashreceipt cancellation)는 발행된 현금영수증에 대해 신청취소 혹은 발행취소를 할 수 있는 기능입니다.

> Endpoints

```
PUT /api/v2/admin/cashreceipt/{cashreceipt_no}/cancellation
```

#### \[더보기 상세 내용\]

### Cashreceipt cancellation property list[](#cashreceipt__cancellation-property-list)

| **Attribute** | **Description** |
| --- | --- |
| cashreceipt\_no | 
현금영수증 번호

 |
| order\_id | 

주문번호

 |
| status | 

처리상태

신청취소: canceled\_request  
발행취소: canceled\_issuance

 |

### Update a cash receipt cancellation [](#update-a-cash-receipt-cancellation)cafe24

PUT /api/v2/admin/cashreceipt/{cashreceipt\_no}/cancellation

###### PUT

발행된 현금영수증에 대해 신청취소 혹은 발행취소를 할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **cashreceipt\_no**  
**Required**  
_최소값: \[1\]_

 | 

현금영수증 번호

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| **type**  
**Required** | 

취소 타입

신청취소: request  
발행취소: issue

 |

Update a cash receipt cancellation

*   [Update a cash receipt cancellation](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Collectrequests

수거신청 정보(Collectrequests)는 반품, 교환처리로 수거요청시 수거신청 정보를 수정할 수 있는 리소스입니다.

> Endpoints

```
PUT /api/v2/admin/collectrequests/{request_no}
```

#### \[더보기 상세 내용\]

### Collectrequests property list[](#collectrequests-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| request\_no | 

요청 번호

 |
| order\_id | 

주문번호

 |
| order\_item\_code | 

품주코드

 |
| shipping\_company\_name | 

수거 배송사명

 |
| collect\_tracking\_no | 

수거 송장 번호

 |

### Update a collection request [](#update-a-collection-request)cafe24

PUT /api/v2/admin/collectrequests/{request\_no}

###### PUT

채번되는 송장번호를 이용하여 수거신청 정보를 수정합니다.  
요청번호와 수거 송장 번호를 필수로 입력합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **30** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **request\_no**  
**Required** | 

요청 번호

 |
| **collect\_tracking\_no**  
**Required**  

_최대글자수 : \[40자\]_

 | 

수거 송장 번호

 |

Update a collection request

*   [Update a collection request](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Control

주문 입금확인 제한여부 기능을 제공합니다.

> Endpoints

```
PUT /api/v2/admin/control
```

#### \[더보기 상세 내용\]

### Control property list[](#control-property-list)

| **Attribute** | **Description** |
| --- | --- |
| payments\_control | 
주문 입금확인 제한여부

 |
| direct\_url | 

연결 URL

 |

### Order control [](#order-control)cafe24

PUT /api/v2/admin/control

###### PUT

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **payments\_control**  
**Required** | 
주문 입금확인 제한여부

T:사용함  
F:사용안함

 |
| **direct\_url**  
**Required**  

_URL_

 | 

연결 URL

 |

Order control

*   [Order control](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Exchange

교환(Exchange)은 주문의 교환 접수 상태를 변경하는 리소스입니다.  
교환 접수를 할 수 있으며 교환이 접수된 주문의 상태를 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/exchange/{claim_code}
POST /api/v2/admin/exchange
PUT /api/v2/admin/exchange
```

#### \[더보기 상세 내용\]

### Exchange property list[](#exchange-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| claim\_code | 

반품번호

 |
| claim\_reason\_type | 

구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| claim\_reason | 

사유

 |
| claim\_due\_date | 

교환처리 예정일

 |
| receiver | 

수령자

 |
| reshipping\_detail | 

교환 재발송 정보

 |
| pickup | 

수거지 - 주소

 |
| additional\_payment | 

추가결제

 |
| return\_invoice\_no  

_최대글자수 : \[40자\]_

 | 

반품 송장 번호

 |
| return\_shipping\_company\_name | 

반품 배송업체명

 |
| refund\_methods | 

환불 방식

 |
| refund\_reason | 

비고

 |
| order\_price\_amount | 

상품구매금액

 |
| refund\_amounts | 

환불금액

 |
| shipping\_fee | 

배송비

 |
| return\_ship\_type | 

반품배송비 적용구분

 |
| defer\_commission | 

후불 결제 수수료

 |
| partner\_discount\_amount | 

제휴할인 취소액

 |
| add\_discount\_amount | 

상품별추가할인 취소액

 |
| member\_grade\_discount\_amount | 

회원등급할인 취소액

 |
| shipping\_discount\_amount | 

배송비할인 취소액

 |
| coupon\_discount\_amount | 

쿠폰할인 취소액

 |
| point\_used | 

사용된 적립금 반환액

 |
| credit\_used | 

사용된 예치금 반환액

 |
| undone | 

철회 여부

T : 철회함  
F : 철회안함

 |
| undone\_reason\_type | 

철회 사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| undone\_reason | 

철회 사유

 |
| expose\_order\_detail | 

주문상세내역 노출 여부

T : 노출함  
F : 노출안함

 |
| exposed\_undone\_reason | 

주문상세내역 노출 철회 사유

 |
| items | 

품주코드

 |
| exchanged\_items | 

교환상품

 |
| include\_tax | 

가격에 세금 포함

T: 세금포함  
F: 세금제외

 |
| tax | 

세금 정보

세금 관리자 앱을 사용 안 할 경우 null로 반환

 |
| carrier\_id | 

배송사 아이디

 |
| return\_invoice\_success | 

반송장 처리 성공 여부

T : 성공  
F : 실패  
N : 미집하

 |
| return\_invoice\_fail\_reason  

_최대글자수 : \[100자\]_

 | 

반송장 처리 실패 사유

 |
| cancel\_fee\_amount | 

취소수수료

 |
| status | 

주문상태

accept : 접수  
collected : 수거완료  
exchanged : 교환완료

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

 |
| exchanged\_after\_collected | 

수거완료시 교환완료 여부

T : 사용함  
F : 사용안함

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

 |
| pickup\_completed | 

수거완료 여부

T : 수거완료  
F : 수거전

 |

### Retrieve an exchange [](#retrieve-an-exchange)cafe24 youtube

GET /api/v2/admin/exchange/{claim\_code}

###### GET

교환번호를 입력하여, 교환이 접수된 주문건을 조회합니다.  
주문번호, 반품번호, 사유, 교환처리 예정일 등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **claim\_code**  
**Required** | 

교환번호

 |

Retrieve an exchange

*   [Retrieve an exchange](#none)
*   [Retrieve an exchange with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create multiple exchanges [](#create-multiple-exchanges)cafe24 youtube

POST /api/v2/admin/exchange

###### POST

교환이 신청된 주문의 상태를 교환접수 혹은 교환완료로 등록할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **status**  
**Required** | 

주문상태

accepted : 교환접수  
exchanged : 교환완료

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

DEFAULT F

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

DEFAULT F

 |
| items | 

품주코드

 |
| 

items 하위 요소 보기

**order\_item\_code**  
**Required**  
품주코드

**quantity**  
**Required**  
수량

**exchange\_variant\_code**  
(동일상품 다른 옵션 교환시) 교환 상품 품목 코드







 |
| **same\_product**  
**Required** | 

동일상품교환 여부

T : 동일상품교환  
F : 다른상품교환

 |

Create multiple exchanges

*   [Create multiple exchanges](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update multiple order exchanges [](#update-multiple-order-exchanges)cafe24 youtube

PUT /api/v2/admin/exchange

###### PUT

교환이 접수된 주문의 상태를 수정 할 수 있습니다.  
다건의 주문에 대해 교환접수를 철회하거나, 재고를 복구하거나, 철회사유를 입력할 수 있습니다.  
택배사에 이미 수거요청이 전달되었으나 수거가 필요하지 않게 될 경우, 택배사에 직접 연락하셔서 수거요청을 취소해주셔야 합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **claim\_code**  
**Required** | 

교환번호

 |
| status | 

주문상태

exchanged : 교환완료

 |
| pickup\_completed | 

수거완료 여부

T : 수거완료  
F : 수거전

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

 |
| exchanged\_after\_collected | 

수거완료시 교환완료 여부

T : 사용함  
F : 사용안함

 |
| items | 

품주코드

 |
| 

items 하위 요소 보기

**order\_item\_code**  
품주코드







 |
| undone | 

철회 여부

T : 철회함

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

 |
| undone\_reason\_type | 

철회 사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| undone\_reason  

_최대글자수 : \[2000자\]_

 | 

철회 사유

 |
| expose\_order\_detail | 

주문상세내역 노출 여부

T : 노출함  
F : 노출안함

 |
| exposed\_undone\_reason  

_최대글자수 : \[2000자\]_

 | 

주문상세내역 노출 철회 사유

 |
| return\_invoice\_no  

_최대글자수 : \[40자\]_

 | 

반품 송장 번호

 |
| carrier\_id | 

배송사 아이디

 |
| return\_invoice\_success | 

반송장 처리 성공 여부

T : 성공  
F : 실패  
N : 미집하

 |
| return\_invoice\_fail\_reason  

_최대글자수 : \[100자\]_

 | 

반송장 처리 실패 사유

 |

Update multiple order exchanges

*   [Update multiple order exchanges](#none)
*   [Update pickup status of multiple orders for exchange](#none)
*   [Withdraw the exchange(multiple orders)](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Exchangerequests

교환요청(Exchangerequests)은 주문에 대해 교환을 요청할 수 있는 기능입니다.

> Endpoints

```
POST /api/v2/admin/exchangerequests
PUT /api/v2/admin/exchangerequests
```

#### \[더보기 상세 내용\]

### Exchangerequests property list[](#exchangerequests-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| items | 

품주 목록

 |
| exchange\_request\_no | 

교환신청번호

 |
| undone | 

접수거부 여부

 |
| order\_item\_code | 

품주코드

 |
| additional\_payment\_gateway\_cancel | 

추가 PG 취소

 |

### Bulk exchange request API [](#bulk-exchange-request-api)cafe24 youtube

POST /api/v2/admin/exchangerequests

###### POST

특정 주문에 대해 교환요청 처리를 할 수 있습니다.  
,(콤마)로 여러 건을 동시에 교환요청 할 수 있습니다.  
교환사유와 수거신청 여부를 함께 등록할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **reason\_type**  
**Required** | 

사유 구분

A:고객변심  
E:상품불만족  
K:상품불량  
J:배송오류  
I:기타

 |
| **reason**  
**Required**  

_최대글자수 : \[2000자\]_

 | 

교환신청 사유

 |
| request\_pickup | 

수거신청 여부

T : 수거신청  
F : 직접발송

 |
| pickup | 

수거지역 상세

 |
| 

pickup 하위 요소 보기

**name**  
**Required**  
이름

**phone**  
전화번호

**cellphone**  
**Required**  
휴대전화

**zipcode**  
우편번호

**address1**  
**Required**  
기본 주소

**address2**  
**Required**  
상세 주소







 |
| tracking\_no  

_최대글자수 : \[40자\]_

 | 

반품 송장 번호

 |
| shipping\_company\_name  

_최대글자수 : \[30자\]_

 | 

반품 배송업체명

 |
| refund\_bank\_code | 

환불 은행 코드

 |
| refund\_bank\_name  

_최대글자수 : \[250자\]_

 | 

환불은행명

 |
| refund\_bank\_account\_no | 

환불 계좌번호

 |
| refund\_bank\_account\_holder  

_최대글자수 : \[15자\]_

 | 

환불계좌 예금주 명의

 |
| items | 

품주 목록

 |
| 

items 하위 요소 보기

**order\_item\_code**  
**Required**  
품주코드

**quantity**  
**Required**  
수량







 |
| exchange\_items | 

교환상품정보

 |
| 

exchange\_items 하위 요소 보기

**product\_no**  
**Required**  
상품번호

**variant\_code**  
**Required**  
상품 품목 코드

**quantity**  
**Required**  
수량







 |

Bulk exchange request API

*   [Bulk exchange request API](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Reject an exchange request for multiple items [](#reject-an-exchange-request-for-multiple-items)cafe24 youtube

PUT /api/v2/admin/exchangerequests

###### PUT

교환이 요청된 주문의 특정 품주들에 대하여 교환요청중인 상태를 변경할 수 있습니다.  
접수거부를 할 수 있고 사유를 입력할 수 있습니다.  
,(콤마)로 여러 건의 교환요청 건에 대해 동시에 상태 변경 할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **order\_item\_code**  
**Required** | 

품주코드

 |
| **undone**  
**Required** | 

접수거부 여부

T : 접수거부함

 |
| reason\_type | 

사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| reason  

_최대글자수 : \[2000자\]_

 | 

사유

 |
| display\_reject\_reason | 

주문상세내역 노출설정

T : 노출함  
F : 노출안함

DEFAULT F

 |
| reject\_reason  

_최대글자수 : \[2000자\]_

 | 

거부 사유

 |

Reject an exchange request for multiple items

*   [Reject an exchange request for multiple items](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Fulfillments

배송앱에서 N개의 배송사와 연동하여 배송 정보를 등록하는 기능입니다.

> Endpoints

```
POST /api/v2/admin/fulfillments
```

#### \[더보기 상세 내용\]

### Fulfillments property list[](#fulfillments-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| tracking\_no | 

송장번호

 |
| shipping\_company\_code | 

배송업체 코드

 |
| status | 

주문상태

standby : 배송대기  
shipping : 배송중

 |
| order\_id | 

주문번호

 |
| shipping\_code | 

배송번호

 |
| order\_item\_code | 

품주코드

 |
| carrier\_id | 

배송사 아이디

 |
| post\_express\_flag | 

우체국 택배연동

 |

### Create shipping information for multiple orders via Fulfillment [](#create-shipping-information-for-multiple-orders-via-fulfillment)cafe24

POST /api/v2/admin/fulfillments

###### POST

배송앱에서 여러 주문에 대해 배송 정보를 등록할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **tracking\_no**  
**Required**  

_최대글자수 : \[30자\]_

 | 

송장번호

 |
| **shipping\_company\_code**  
**Required** | 

배송업체 코드

 |
| **status**  
**Required** | 

주문상태

standby : 배송대기  
shipping : 배송중

 |
| order\_id | 

주문번호

 |
| shipping\_code | 

배송번호

 |
| order\_item\_code | 

품주코드

 |
| carrier\_id | 

배송사 아이디

 |
| post\_express\_flag | 

우체국 택배연동

S : 송장 전송 완료

 |

Create shipping information for multiple orders via Fulfillment

*   [Create shipping information for multiple orders via Fulfillment](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Labels

Labels(주문 라벨)이란, 각각의 주문을 쉽게 식별하고 구분할 수 있도록 도와주는 기능입니다.

> Endpoints

```
GET /api/v2/admin/labels
POST /api/v2/admin/labels
```

#### \[더보기 상세 내용\]

### Labels property list[](#labels-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| names | 

주문 라벨명

 |
| name | 

주문 라벨명

 |
| order\_item\_code | 

품주코드

 |

### Retrieve order labels [](#retrieve-order-labels)cafe24

GET /api/v2/admin/labels

###### GET

특정 주문의 라벨을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| limit  
_최소: \[1\]~최대: \[1000\]_

 | 

조회결과 최대건수

DEFAULT 100

 |
| offset  

_최대값: \[15000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve order labels

*   [Retrieve order labels](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create multiple order labels [](#create-multiple-order-labels)cafe24

POST /api/v2/admin/labels

###### POST

특정 주문에 라벨을 등록할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **name**  
**Required** | 

주문 라벨명

 |
| **order\_item\_code**  
**Required** | 

품주코드

 |

Create multiple order labels

*   [Create multiple order labels](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orderform properties

구매자가 주문할 때 추가로 입력받아야 하는 항목을 설정 할 수 있는 기능입니다.

> Endpoints

```
GET /api/v2/admin/orderform/properties
POST /api/v2/admin/orderform/properties
PUT /api/v2/admin/orderform/properties/{orderform_property_id}
DELETE /api/v2/admin/orderform/properties/{orderform_property_id}
```

#### \[더보기 상세 내용\]

### Orderform properties property list[](#orderform-properties-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| additional\_items | 

주문서 추가항목

 |
| input\_type | 

주문서 추가항목 입력 형식

T : 텍스트박스(한줄)  
M : 텍스트박스(여러줄)  
R : 라디오버튼  
C : 체크박스  
S : 셀렉트박스  
D : 캘린더  
I : 시간

 |
| is\_required | 

주문서 추가항목 필수 여부

T : 필수  
F : 선택

 |
| subject | 

주문서 추가항목명

 |
| available\_product\_type | 

적용 대상 상품 설정

A : 전체상품  
C : 상품분류별  
P : 개별상품

 |
| input\_scope | 

입력값 적용 범위 (공통 또는 상품별)

A : 공통으로 한번만 입력 받기  
P : 상품별로 입력 받기

 |
| description | 

주문서 추가항목 설명

 |
| field\_length | 

주문서 추가항목 필드 길이 (텍스트박스)

 |
| max\_input\_length | 

주문서 추가항목 입력 가능한 최대 글자 수

 |
| textarea\_rows | 

주문서 추가항목 행 수 (여러 줄 입력 시)

 |
| width\_percentage | 

주문서 추가항목 가로길이 (%)

 |
| option\_values | 

주문서 추가항목 입력값

 |
| display\_lines\_desktop | 

한 줄에 표시할 옵션 개수 (PC)

 |
| display\_lines\_mobile | 

한 줄에 표시할 옵션 개수 (모바일)

 |
| category\_no | 

주문서 추가항목 지정 상품분류 번호

 |
| product\_no | 

주문서 추가항목 지정 상품 번호

 |
| orderform\_property\_id | 

주문서 추가항목 고유번호

 |

### Retrieve an additional checkout field [](#retrieve-an-additional-checkout-field)cafe24

GET /api/v2/admin/orderform/properties

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve an additional checkout field

*   [Retrieve an additional checkout field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create an additional checkout field [](#create-an-additional-checkout-field)cafe24

POST /api/v2/admin/orderform/properties

###### POST

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **input\_type**  
**Required** | 

주문서 추가항목 입력 형식

T : 텍스트박스(한줄)  
M : 텍스트박스(여러줄)  
R : 라디오버튼  
C : 체크박스  
S : 셀렉트박스  
D : 캘린더  
I : 시간

 |
| **is\_required**  
**Required** | 

주문서 추가항목 필수 여부

T : 필수  
F : 선택

 |
| **subject**  
**Required** | 

주문서 추가항목명

 |
| **available\_product\_type**  
**Required** | 

적용 대상 상품 설정

A : 전체상품  
C : 상품분류별  
P : 개별상품

 |
| **input\_scope**  
**Required** | 

입력값 적용 범위 (공통 또는 상품별)

A : 공통으로 한번만 입력 받기  
P : 상품별로 입력 받기

 |
| description  

_최대글자수 : \[500자\]_

 | 

주문서 추가항목 설명

 |
| field\_length  

_최소: \[1\]~최대: \[250\]_

 | 

주문서 추가항목 필드 길이 (텍스트박스)

input\_type를 "T"로 선택 하였을때만 입력 가능

 |
| max\_input\_length  

_최소: \[1\]~최대: \[250\]_

 | 

주문서 추가항목 입력 가능한 최대 글자 수

input\_type를 "T"로 선택 하였을때만 입력 가능

 |
| textarea\_rows  

_최소: \[1\]~최대: \[70\]_

 | 

주문서 추가항목 행 수 (여러 줄 입력 시)

input\_type를 "M"로 선택 하였을때만 입력 가능

 |
| width\_percentage  

_최소: \[1\]~최대: \[100\]_

 | 

주문서 추가항목 가로길이 (%)

input\_type를 "M"로 선택 하였을때만 입력 가능

 |
| option\_values | 

주문서 추가항목 입력값

input\_type를 "R", "C", "S", "I"로 선택 하였을때만 입력 가능  
input\_type를 "R", "C", "S" 로 입력한 경우 구분자 "/" 로 입력(빨강/노랑/파랑)  
input\_type를 "I" 로 입력한 경우 아래와 같이 시간정보를 입력  
예) "{"time\_start":"00:00","time\_end":"01:00","time\_interval":"60"}

예) 빨강/노랑/파랑

 |
| display\_lines\_desktop  

_최소: \[1\]~최대: \[999\]_

 | 

한 줄에 표시할 옵션 개수 (PC)

input\_type를 "R", "C"로 선택 하였을때만 입력 가능

 |
| display\_lines\_mobile  

_최소: \[1\]~최대: \[999\]_

 | 

한 줄에 표시할 옵션 개수 (모바일)

input\_type를 "R", "C"로 선택 하였을때만 입력 가능

 |
| category\_no | 

주문서 추가항목 지정 상품분류 번호

available\_product\_type를 "P"로 선택 하였을때만 입력 가능(C도 마찬가지)

 |
| product\_no | 

주문서 추가항목 지정 상품 번호

available\_product\_type를 "P"로 선택 하였을때만 입력 가능(C도 마찬가지)

 |

Create an additional checkout field

*   [Create an additional checkout field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update an additional checkout field [](#update-an-additional-checkout-field)cafe24

PUT /api/v2/admin/orderform/properties/{orderform\_property\_id}

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **orderform\_property\_id**  
**Required** | 

주문서 추가항목 고유번호

 |
| input\_type | 

주문서 추가항목 입력 형식

T : 텍스트박스(한줄)  
M : 텍스트박스(여러줄)  
R : 라디오버튼  
C : 체크박스  
S : 셀렉트박스  
D : 캘린더  
I : 시간

 |
| is\_required | 

주문서 추가항목 필수 여부

T : 필수  
F : 선택

 |
| subject | 

주문서 추가항목명

 |
| description  

_최대글자수 : \[500자\]_

 | 

주문서 추가항목 설명

 |
| field\_length  

_최소: \[1\]~최대: \[250\]_

 | 

주문서 추가항목 필드 길이 (텍스트박스)

input\_type를 "T"로 선택 하였을때만 입력 가능

 |
| max\_input\_length  

_최소: \[1\]~최대: \[250\]_

 | 

주문서 추가항목 입력 가능한 최대 글자 수

input\_type를 "T"로 선택 하였을때만 입력 가능

 |
| textarea\_rows  

_최소: \[1\]~최대: \[70\]_

 | 

주문서 추가항목 행 수 (여러 줄 입력 시)

input\_type를 "M"로 선택 하였을때만 입력 가능

 |
| width\_percentage  

_최소: \[1\]~최대: \[100\]_

 | 

주문서 추가항목 가로길이 (%)

input\_type를 "M"로 선택 하였을때만 입력 가능

 |
| option\_values | 

주문서 추가항목 입력값

input\_type를 "R", "C", "S", "I"로 선택 하였을때만 입력 가능  
input\_type를 "R", "C", "S" 로 입력한 경우 구분자 "/" 로 입력(빨강/노랑/파랑)  
input\_type를 "I" 로 입력한 경우 아래와 같이 시간정보를 입력  
예) "{"time\_start":"00:00","time\_end":"01:00","time\_interval":"60"}

예) 빨강/노랑/파랑

 |
| display\_lines\_desktop  

_최소: \[1\]~최대: \[999\]_

 | 

한 줄에 표시할 옵션 개수 (PC)

input\_type를 "R", "C"로 선택 하였을때만 입력 가능

 |
| display\_lines\_mobile  

_최소: \[1\]~최대: \[999\]_

 | 

한 줄에 표시할 옵션 개수 (모바일)

input\_type를 "R", "C"로 선택 하였을때만 입력 가능

 |
| available\_product\_type | 

적용 대상 상품 설정

A : 전체상품  
C : 상품분류별  
P : 개별상품

 |
| input\_scope | 

입력값 적용 범위 (공통 또는 상품별)

A : 공통으로 한번만 입력 받기  
P : 상품별로 입력 받기

 |
| category\_no | 

주문서 추가항목 지정 상품분류 번호

available\_product\_type를 "P"로 선택 하였을때만 입력 가능(C도 마찬가지)

 |
| product\_no | 

주문서 추가항목 지정 상품 번호

available\_product\_type를 "P"로 선택 하였을때만 입력 가능(C도 마찬가지)

 |

Update an additional checkout field

*   [Update an additional checkout field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete an additional checkout field [](#delete-an-additional-checkout-field)cafe24

DELETE /api/v2/admin/orderform/properties/{orderform\_property\_id}

###### DELETE

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **orderform\_property\_id**  
**Required** | 

주문서 추가항목 고유번호

 |

Delete an additional checkout field

*   [Delete an additional checkout field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Orders.png)  
  
주문(Order)은 쇼핑몰에서 고객이 상품의 구매의사를 쇼핑몰에 요청한 내역입니���.  
결제수단이 무통장입금인 경우 입금전에도 주문은 생성됩니다.  
쇼핑몰 운영자는 결제가 완료된 주문 정보를 참고하여 쇼핑몰 고객에게 물건을 배송합니다.  
주문 정보에는 주문과 결제를 진행한 주문자의 정보와 상품을 배송 받을 수령자 정보가 포함됩니다.  
주문은 품주, 주문자정보 등 여러 하위 리소스들을 갖고 있습니다.

> Endpoints

```
GET /api/v2/admin/orders
GET /api/v2/admin/orders/{order_id}
GET /api/v2/admin/orders/count
PUT /api/v2/admin/orders
PUT /api/v2/admin/orders/{order_id}
```

#### \[더보기 상세 내용\]

### Orders property list[](#orders-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| currency | 

화폐단위

해당 멀티쇼핑몰의 화폐단위

 |
| order\_id | 

주문번호

 |
| market\_id | 

마켓 구분값

가격 비교 사이트를 통하여 마켓 등에서 상품 구매 시 해당 사이트를 구분하기 위한 ID

 |
| market\_order\_no | 

마켓 주문 번호

 |
| member\_id | 

회원아이디

 |
| member\_email | 

회원 이메일

 |
| member\_authentication | 

회원인증여부

회원 인증여부. 인증여부에 따라 3가지로 회원타입이 나눠짐.

T : 승인  
B : 특별관리회원  
J : 14세미만회원

 |
| billing\_name | 

결제자명

입금자 이름. 주문자 혹은 수령자 이름과는 다를 수 있음.

 |
| bank\_code | 

은행코드

[bank\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/bank_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| bank\_code\_name | 

입금자 은행명

 |
| payment\_method | 

결제수단 코드

주문자가 이용한 결제수단의 코드

cash : 무통장  
card : 신용카드  
cell : 휴대폰  
tcash : 계좌이체  
icash : 가상계좌  
prepaid : 선불금  
credit : 예치금  
point : 적립금  
pointfy : 통합포인트  
cvs : 편의점  
cod : 후불  
coupon : 쿠폰  
market\_discount : 마켓할인  
giftcard : 제휴상품권  
pointcard : 제휴포인트  
etc : 기타

 |
| payment\_method\_name | 

결제수단명

주문자가 이용한 결제수단의 이름

 |
| payment\_gateway\_names | 

PG 이름

 |
| sub\_payment\_method\_name | 

해외 결제수단명

 |
| sub\_payment\_method\_code | 

해외 결제수단코드

[sub\_payment\_method\_code](https://s3.ap-northeast-2.amazonaws.com/appservice-guide/resource/ko/sub_payment_code_kr.csv) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| transaction\_ids | 

카드 거래 아이디

 |
| paid | 

결제 여부

결제가 완료되었는지 여부

T : 결제  
F : 미결제  
M : 부분 결제

 |
| canceled | 

취소 여부

T : 취소  
F : 미취소  
M : 부분 취소

 |
| order\_date | 

주문일

 |
| first\_order | 

최초 주문여부

해당 주문이 최초 주문인지 여부

T : 최초 주문  
F : 최초 주문 아님

 |
| payment\_date | 

결제일

 |
| order\_from\_mobile | 

모바일 구분

주문이 모바일에서 이루어졌는지 여부

T : 모바일 주문  
F : 모바일 주문 아님

 |
| use\_escrow | 

에스크로 사용여부

에스크로를 사용했는지 여부

T : 에스크로 사용  
F : 에스크로 미사용

 |
| group\_no\_when\_ordering | 

주문시 회원등급

 |
| initial\_order\_amount | 

최초 주문 금액

 |
| actual\_order\_amount | 

현재 주문 금액

실결제금액 중 coupon\_shipping\_fee\_amount는 할인 금액 자동 계산을 사용할 때만 품목별로 배송비 배분이 가능하기 때문에 할인 금액 자동 계산 기능을 사용할 때만 노출됨

 |
| bank\_account\_no | 

계좌번호

해당 주문건에 대한 쇼핑몰의 계좌번호

 |
| bank\_account\_owner\_name | 

예금주

 |
| market\_seller\_id | 

마켓 판매자 아이디

 |
| payment\_amount | 

최종 결제 금액

 |
| cancel\_date | 

주문취소일

 |
| order\_place\_name | 

주문경로 텍스트

 |
| order\_place\_id | 

주문경로

 |
| payment\_confirmation | 

후불결제 입금확인 가능 여부

T : 입금확인  
F : 입금미확인

 |
| commission | 

결제 수수료

 |
| postpay | 

후불결제여부

T : 후불결제  
F : 후불결제 아님

 |
| admin\_additional\_amount | 

관리자 입력 금액

 |
| additional\_shipping\_fee | 

추가 배송비

 |
| international\_shipping\_insurance | 

해외배송 보험료

 |
| additional\_handling\_fee | 

해외배송 부가금액

 |
| shipping\_type | 

배송 유형

배송 유형. 국내배송인지 해외배송인지 여부

A : 국내  
B : 해외

 |
| shipping\_type\_text | 

배송 유형명

배송 유형. 국내배송인지 해외배송인지 여부

 |
| shipping\_status | 

배송상태

F : 배송전  
M : 배송중  
T : 배송완료  
W : 배송보류  
X : 발주전

 |
| wished\_delivery\_date | 

희망배송일

 |
| wished\_delivery\_time | 

희망배송시간

 |
| wished\_carrier\_id | 

희망배송사 코드

 |
| wished\_carrier\_name | 

희망배송사 명

 |
| return\_confirmed\_date | 

반품승인일시

 |
| total\_supply\_price | 

총 공급가액

 |
| naver\_point | 

네이버포인트

 |
| additional\_order\_info\_list | 

주문서 추가항목

 |
| store\_pickup | 

매장수령여부

T : 매장수령  
F : 매장수령 아님

 |
| easypay\_name | 

간편결제 결제사 이름

 |
| loan\_status | 

여신상태

OK : GOOD  
NG : NOT GOOD  
ER : ERROR

 |
| subscription | 

정기결제 여부

T : 정기결제  
F : 정기결제 아님

 |
| items | 

품주 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| receivers | 

수령자정보 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| buyer | 

주문자정보 리소스

 |
| shipping\_fee\_detail | 

배송비 정보

 |
| regional\_surcharge\_detail | 

지역별 배송비 정보

 |
| return | 

반품상세 리소스

 |
| cancellation | 

취소상세 리소스

 |
| exchange | 

교환상세 리소스

 |
| multiple\_addresses | 

멀티 배송지 여부

T : 멀티 배송지 주문  
F : 멀티 배송지 주문 아님

 |
| exchange\_rate | 

결제 화폐 환율 정보

 |
| first\_payment\_methods | 

최초 결제수단 코드

cash : 무통장  
card : 신용카드  
cell : 휴대폰  
tcash : 계좌이체  
icash : 가상계좌  
prepaid : 선불금  
credit : 예치금  
point : 적립금  
pointfy : 통합포인트  
cvs : 편의점  
cod : 후불  
giftcard : 제휴상품권  
pointcard : 제휴포인트  
etc : 기타

 |
| naverpay\_payment\_information | 

네이버페이 PG 결제 정보

P : PG결제  
N : 네이버결제

 |
| include\_tax | 

가격에 세금 포함

T: 세금포함  
F: 세금제외

 |
| tax\_detail | 

세금 상세 정보

 |
| service\_type | 

주문 서비스 유형

rental : 렌탈주문

 |
| service\_data | 

주문 서비스 데이터

 |
| show\_shipping\_address | 

배송지 정보 표기 여부

T: 배송지 정보 표기  
F: 배송지 정보 가림

 |
| social\_member\_code | 

연동 된 SNS 제공코드

 |
| social\_name | 

연동 된 SNS명

 |
| customer\_group\_no\_when\_ordering | 

주문시 회원등급

주문 당시의 회원등급

 |
| benefits | 

혜택 리소스

 |
| coupons | 

쿠폰 리소스

 |
| refunds | 

환불상세 리소스

 |
| process\_status | 

주문상태

prepare : 배송준비중  
prepareproduct : 상품준비중  
hold : 배송보류  
unhold : 배송보류해제

 |
| order\_item\_code | 

품주코드

 |
| purchase\_confirmation | 

구매확정 여부

 |
| collect\_points | 

적립금 회수

 |

### Retrieve a list of orders [](#retrieve-a-list-of-orders)cafe24 youtube

GET /api/v2/admin/orders

###### GET

주문을 목록으로 조회할 수 있습니다.  
주문번호, 화폐단위, 회원아이디 등을 조회할 수 있습니다.  
하위 리소스들을 embed 로 활용하면 한번의 호출에 필요한 정보를 더 많이 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| items  
**embed** | 
품주 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| receivers  
**embed** | 

수령자정보 리소스

  
조회시 Embed 파라메터를 사용하여 조회할 수 있다.

 |
| buyer  
**embed** | 

주문자정보 리소스

 |
| return  
**embed** | 

반품상세 리소스

 |
| cancellation  
**embed** | 

취소상세 리소스

 |
| exchange  
**embed** | 

교환상세 리소스

 |
| multiple\_addresses | 

멀티 배송지 여부

T : 멀티 배송지 주문

 |
| first\_order | 

최초 주문여부

T : 최초 주문  
F : 최초 주문 아님

 |
| shop\_no  

_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| start\_date  

_날짜_

 | 

검색 시작일

검색을 시작할 기준일

 |
| end\_date  

_날짜_

 | 

검색 종료일

검색을 종료할 기준일  
검색 시작일과 같이 사용해야함.  
검색기간은 한 호출에 3개월 이상 검색 불가.

 |
| order\_id  

_주문번호_

 | 

주문번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| order\_status | 

주문상태

주문상태. 주문 상태별로 각각의 코드가 있음.

,(콤마)로 여러 건을 검색할 수 있다.

N00 : 입금전  
N10 : 상품준비중  
N20 : 배송준비중  
N21 : 배송대기  
N22 : 배송보류  
N30 : 배송중  
N40 : 배송완료  
N50 : 구매확정  
C00 : 취소신청  
C10 : 취소접수 - 관리자  
C11 : 취소접수거부 - 관리자  
C34 : 취소처리중 - 환불전  
C35 : 취소처리중 - 환불완료  
C36 : 취소처리중 - 환불보류  
C40 : 취소완료  
C41 : 취소 완료 - 환불전  
C42 : 취소 완료 - 환불요청중  
C43 : 취소 완료 - 환불보류  
C47 : 입금전취소 - 구매자  
C48 : 입금전취소 - 자동취소  
C49 : 입금전취소 - 관리자  
R00 : 반품신청  
R10 : 반품접수  
R11 : 반품 접수 거부  
R12 : 반품보류  
R13 : 반품접수 - 수거완료(자동)  
R20 : 반품 수거 완료  
R30 : 반품처리중 - 수거전  
R31 : 반품처리중 - 수거완료  
R34 : 반품처리중 - 환불전  
R36 : 반품처리중 - 환불보류  
R40 : 반품완료 - 환불완료  
R41 : 반품완료 - 환불전  
R42 : 반품완료 - 환불요청중  
R43 : 반품완료 - 환불보류  
E00 : 교환신청  
E10 : 교환접수  
N01 : 교환접수 - 교환상품  
N02 : 입금전 - 카드결제대기  
N03 : 교환접수 - 카드결제대기  
E11 : 교환접수거부  
E12 : 교환보류  
E13 : 교환접수 - 수거완료(자동)  
E20 : 교환준비  
E30 : 교환처리중 - 수거전  
E31 : 교환처리중 - 수거완료  
E32 : 교환처리중 - 입금전  
E33 : 교환처리중 - 입금완료  
E34 : 교환처리중 - 환불전  
E35 : 교환처리중 - 환불완료  
E36 : 교환처리중 - 환불보류  
E40 : 교환완료

 |
| payment\_status | 

결제상태

F : 입금전  
M : 추가입금대기  
T : 입금완료(수동)  
A : 입금완료(자동)  
P : 결제완료

 |
| member\_type | 

회원여부

회원여부. 회원과 비회원 각각의 코드가 있음.

2 : 회원  
3 : 비회원

 |
| group\_no | 

회원등급번호

 |
| buyer\_name | 

주문자명

주문자 이름. 입금자 혹은 수령자 이름과는 다를 수 있음.

 |
| receiver\_name | 

수령자명

수령자 이름. 주문자 혹은 입금자 이름과는 다를 수 있음.

 |
| name\_furigana | 

수령자명 (발음)

 |
| receiver\_address | 

수령자주소

수령자 주소. 주문자 혹은 입금자 주소와는 다를 수 있음.

 |
| member\_id | 

회원아이디

회원 아이디

 |
| member\_email | 

회원 이메일

 |
| product\_no | 

상품번호

상품 번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| product\_code | 

상품코드

상품 코드

 |
| date\_type | 

검색날짜 유형

검색을 위한 날짜 유형 기준. 기본값은 주문일로 설정되어 있음.

order\_date : 주문일  
pay\_date : 결제일  
shipbegin\_date : 배송시작일  
shipend\_date : 배송완료일  
cancel\_date : 주문취소일  
place\_date : 발주일  
cancel\_request\_date : 취소신청일  
cancel\_accept\_date : 취소접수일  
cancel\_complete\_date : 취소완료일  
exchange\_request\_date : 교환신청일  
exchange\_accept\_date : 교환접수일  
exchange\_complete\_date : 교환완료일  
return\_request\_date : 반품신청일  
return\_accept\_date : 반품접수일  
return\_complete\_date : 반품완료일  
purchaseconfirmation\_date : 구매확정일

DEFAULT order\_date

 |
| supplier\_id | 

공급사 아이디

,(콤마)로 여러 건을 검색할 수 있다.

 |
| order\_place\_id | 

주문경로

,(콤마)로 여러 건을 검색할 수 있다.

cafe24:카페24  
mobile:모바일웹  
mobile\_d:모바일앱  
NCHECKOUT:네이버페이  
inpark:인터파크  
auction:옥션  
sk11st:11번가  
gmarket:G마켓  
coupang:쿠팡  
shopn:스마트스토어

 |
| buyer\_cellphone | 

주문자 휴대 전화

 |
| buyer\_phone | 

주문자 일반 전화

 |
| buyer\_email | 

주문자 이메일

 |
| inflow\_path | 

유입경로

 |
| subscription | 

정기결제 여부

T : 정기결제  
F : 정기결제 아님

 |
| market\_order\_no  

_형식 : \[a-zA-Z0-9\_-\]_  
_최대글자수 : \[40자\]_

 | 

마켓 주문 번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| market\_cancel\_request | 

마켓 취소요청 여부

T : 취소 요청된 마켓 주문

 |
| payment\_method | 

결제수단 코드

,(콤마)로 여러 건을 검색할 수 있다.

cash : 무통장  
card : 신용카드  
tcash : 계좌이체  
icash : 가상계좌  
cell : 휴대폰  
deferpay : 후불  
cvs : 편의점  
point : 선불금  
mileage : 적립금  
deposit : 예치금  
giftcard : 제휴상품권  
pointcard : 제휴포인트  
etc : 기타

 |
| payment\_gateway\_name | 

PG 이름

,(콤마)로 여러 건을 검색할 수 있다.

 |
| market\_seller\_id | 

마켓 판매자 아이디

 |
| discount\_method | 

할인수단

,(콤마)로 여러 건을 검색할 수 있다.

point : 적립금  
credit : 예치금  
coupon : 쿠폰  
market\_discount : 마켓할인  
discount\_code : 할인코드

 |
| discount\_code | 

할인코드

 |
| carrier\_id  

_최소값: \[1\]_

 | 

배송사 아이디

 |
| wished\_carrier\_id  

_최소값: \[1\]_

 | 

희망배송사 아이디

,(콤마)로 여러 건을 검색할 수 있다.

 |
| labels | 

주문 라벨

,(콤마)로 여러 건을 검색할 수 있다.

 |
| refund\_status | 

CS(환불)상태

,(콤마)로 여러 건을 검색할 수 있다.

F : 환불전  
T : 환불완료  
M : 환불보류

 |
| limit  

_최소: \[1\]~최대: \[1000\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

 |
| offset  

_최대값: \[15000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a list of orders

*   [Retrieve a list of orders](#none)
*   [Retrieve multiple orders](#none)
*   [Retrieve orders using fields parameter](#none)
*   [Retrieve orders using embed parameter](#none)
*   [Retrieve orders using paging](#none)
*   [Retrieve orders before payment](#none)
*   [Retrieve orders by shipping date](#none)
*   [Retrieve orders except market orders](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve an order [](#retrieve-an-order)cafe24 youtube

GET /api/v2/admin/orders/{order\_id}

###### GET

주문 1건을 조회할 수 있습니다.  
주문번호, 회원아이디, 결제수단 등을 조회할 수 있습니다.  
하위 리소스들을 embed 로 활용하면 한번의 호출에 필요한 정보를 더 많이 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| items  
**embed** | 

품주 리소스

 |
| receivers  
**embed** | 

수령자정보 리소스

 |
| buyer  
**embed** | 

주문자정보 리소스

 |
| benefits  
**embed** | 

혜택 리소스

 |
| coupons  
**embed** | 

쿠폰 리소스

**Youtube shopping 이용 시에는 미제공**

 |
| return  
**embed** | 

반품상세 리소스

 |
| cancellation  
**embed** | 

취소상세 리소스

 |
| exchange  
**embed** | 

교환상세 리소스

 |
| refunds  
**embed** | 

환불상세 리소스

 |

Retrieve an order

*   [Retrieve an order](#none)
*   [Retrieve an order with fields parameter](#none)
*   [Retrieve an order with embed](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of orders [](#retrieve-a-count-of-orders)cafe24 youtube

GET /api/v2/admin/orders/count

###### GET

주문의 수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| multiple\_addresses | 
멀티 배송지 여부

T : 멀티 배송지 주문

 |
| first\_order | 

최초 주문여부

T : 최초 주문  
F : 최초 주문 아님

 |
| shop\_no  

_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| start\_date  

_날짜_

 | 

검색 시작일

검색을 시작할 기준일

 |
| end\_date  

_날짜_

 | 

검색 종료일

검색을 종료할 기준일  
검색 시작일과 같이 사용해야함.  
검색기간은 한 호출에 3개월 이상 검색 불가.

 |
| order\_id  

_주문번호_

 | 

주문번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| order\_status | 

주문상태

주문상태. 주문 상태별로 각각의 코드가 있음.

,(콤마)로 여러 건을 검색할 수 있다.

N00 : 입금전  
N10 : 상품준비중  
N20 : 배송준비중  
N21 : 배송대기  
N22 : 배송보류  
N30 : 배송중  
N40 : 배송완료  
N50 : 구매확정  
C00 : 취소신청  
C10 : 취소접수 - 관리자  
C11 : 취소접수거부 - 관리자  
C34 : 취소처리�� - 환불전  
C35 : 취소처리중 - 환불완료  
C36 : 취소처리중 - 환불보류  
C40 : 취소완료  
C41 : 취소 완료 - 환불전  
C42 : 취소 완료 - 환불요청중  
C43 : 취소 완료 - 환불보류  
C47 : 입금전취소 - 구매자  
C48 : 입금전취소 - 자동취소  
C49 : 입금전취소 - 관리자  
R00 : 반품신청  
R10 : 반품접수  
R11 : 반품 접수 거부  
R12 : 반품보류  
R13 : 반품접수 - 수거완료(자동)  
R20 : 반품 수거 완료  
R30 : 반품처리중 - 수거전  
R31 : 반품처리중 - 수거완료  
R34 : 반품처리중 - 환불전  
R36 : 반품처리중 - 환불보류  
R40 : 반품완료 - 환불완료  
R41 : 반품완료 - 환불전  
R42 : 반품완료 - 환불요청중  
R43 : 반품완료 - 환불보류  
E00 : 교환신청  
E10 : 교환접수  
N01 : 교환접수 - 교환상품  
N02 : 입금전 - 카드결제대기  
N03 : 교환접수 - 카드결제대기  
E11 : 교환접수거부  
E12 : 교환보류  
E13 : 교환접수 - 수거완료(자동)  
E20 : 교환준비  
E30 : 교환처리중 - 수거전  
E31 : 교환처리중 - 수거완료  
E32 : 교환처리중 - 입금전  
E33 : 교환처리중 - 입금완료  
E34 : 교환처리중 - 환불전  
E35 : 교환처리중 - 환불완료  
E36 : 교환처리중 - 환불보류  
E40 : 교환완료

 |
| payment\_status | 

결제상태

F : 입금전  
M : 추가입금대기  
T : 입금완료(수동)  
A : 입금완료(자동)  
P : 결제완료

 |
| member\_type | 

회원여부

회원여부. 회원과 비회원 각각의 코드가 있음.

2 : 회원  
3 : 비회원

 |
| group\_no | 

회원등급번호

 |
| buyer\_name | 

주문자명

주문자 이름. 입금자 혹은 수령자 이름과는 다를 수 있음.

 |
| receiver\_name | 

수령자명

수령자 이름. 주문자 혹은 입금자 이름과는 다를 수 있음.

 |
| name\_furigana | 

수령자명 (발음)

 |
| receiver\_address | 

수령자주소

수령자 주소. 주문자 혹은 입금자 주소와는 다를 수 있음.

 |
| member\_id | 

회원아이디

회원 아이디

 |
| member\_email | 

회원 이메일

 |
| product\_no | 

상품번호

상품 번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| product\_code | 

상품코드

검색어를 상품코드에 포함하고 있는 상품 검색(대소문자 구분 필요)

 |
| date\_type | 

검색날짜 유형

검색을 위한 날짜 유형 기준. 기본값은 주문일로 설정되어 있음.

order\_date : 주문일  
pay\_date : 결제일  
shipbegin\_date : 배송시작일  
shipend\_date : 배송완료일  
cancel\_date : 주문취소일  
place\_date : 발주일  
cancel\_request\_date : 취소신청일  
cancel\_accept\_date : 취소접수일  
cancel\_complete\_date : 취소완료일  
exchange\_request\_date : 교환신청일  
exchange\_accept\_date : 교환접수일  
exchange\_complete\_date : 교환완료일  
return\_request\_date : 반품신청일  
return\_accept\_date : 반품접수일  
return\_complete\_date : 반품완료일  
purchaseconfirmation\_date : 구매확정일

DEFAULT order\_date

 |
| supplier\_id | 

공급사 아이디

,(콤마)로 여러 건을 검색할 수 있다.

 |
| order\_place\_id | 

주문경로

,(콤마)로 여러 건을 검색할 수 있다.

cafe24:카페24  
mobile:모바일웹  
mobile\_d:모바일앱  
NCHECKOUT:네이버페이  
inpark:인터파크  
auction:옥션  
sk11st:11번가  
gmarket:G마켓  
coupang:쿠팡  
shopn:스마트스토어

 |
| buyer\_cellphone | 

주문자 휴대 전화

 |
| buyer\_phone | 

주문자 일반 전화

 |
| buyer\_email | 

주문자 이메일

 |
| inflow\_path | 

유입경로

 |
| subscription | 

정기결제 여부

T : 정기결제  
F : 정기결제 아님

 |
| market\_order\_no  

_형식 : \[a-zA-Z0-9\_-\]_  
_최대글자수 : \[40자\]_

 | 

마켓 주문 번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| market\_cancel\_request | 

마켓 취소요청 여부

T : 취소 요청된 마켓 주문

 |
| payment\_method | 

결제수단 코드

,(콤마)로 여러 건을 검색할 수 있다.

cash : 무통장  
card : 신용카드  
tcash : 계좌이체  
icash : 가상계좌  
cell : 휴대폰  
deferpay : 후불  
cvs : 편의점  
point : 선불금  
mileage : 적립금  
deposit : 예치금  
giftcard : 제휴상품권  
pointcard : 제휴포인트  
etc : 기타

 |
| payment\_gateway\_name | 

PG 이름

,(콤마)로 여러 건을 검색할 수 있다.

 |
| market\_seller\_id | 

마켓 판매자 아이디

 |
| discount\_method | 

할인수단

,(콤마)로 여러 건을 검색할 수 있다.

point : 적립금  
credit : 예치금  
coupon : 쿠폰  
market\_discount : 마켓할인  
discount\_code : 할인코드

 |
| discount\_code | 

할인코드

 |
| carrier\_id  

_최소값: \[1\]_

 | 

배송사 아이디

 |
| wished\_carrier\_id  

_최소값: \[1\]_

 | 

희망배송사 아이디

,(콤마)로 여러 건을 검색할 수 있다.

 |
| labels | 

주문 라벨

,(콤마)로 여러 건을 검색할 수 있다.

 |
| refund\_status | 

CS(환불)상태

,(콤마)로 여러 건을 검색할 수 있다.

F : 환불전  
T : 환불완료  
M : 환불보류

 |

Retrieve a count of orders

*   [Retrieve a count of orders](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update status for multiple orders [](#update-status-for-multiple-orders)cafe24 youtube

PUT /api/v2/admin/orders

###### PUT

여러건의 주문의 주문상태를 수정할 수 있습니다.  
구매자나 수령자의 정보를 수정하기 위해서는 Orders buyer, Orders receivers 를 확인해주세요.  
주문의 배송처리는 Orders shipments 를 확인해주세요.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| process\_status | 

주문상태

prepare : 배송준비중  
prepareproduct : 상품준비중  
hold : 배송보류  
unhold : 배송보류해제

 |
| order\_item\_code | 

품주코드

 |
| purchase\_confirmation | 

구매확정 여부

T : 구매확정  
F : 구매확정 철회

 |
| collect\_points | 

적립금 회수

**Youtube shopping 이용 시에는 미제공**

T: 회수  
F: 회수안함

DEFAULT F

 |
| show\_shipping\_address | 

배송지 정보 표기 여부

T: 배송지 정보 표기  
F: 배송지 정보 가림

 |

Update status for multiple orders

*   [Update status for multiple orders](#none)
*   [Update status of multiple orders to prepare for shipment](#none)
*   [Update status of multiple orders to hold shipment](#none)
*   [Remove multiple orders from held off shipping](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update an order status [](#update-an-order-status)cafe24 youtube

PUT /api/v2/admin/orders/{order\_id}

###### PUT

주문 1건의 주문상태를 수정할 수 있습니다.  
구매자나 수령자의 정보를 수정하기 위해서는 Orders buyer, Orders receivers 를 확인해주세요.  
주문의 배송처리는 Orders shipments 를 확인해주세요.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| process\_status | 

주문상태

prepare : 배송준비중  
prepareproduct : 상품준비중  
hold : 배송보류  
unhold : 배송보류해제

 |
| order\_item\_code | 

품주코드

 |
| purchase\_confirmation | 

구매확정 여부

T : 구매확정  
F : 구매확정 철회

 |
| collect\_points | 

적립금 회수

**Youtube shopping 이용 시에는 미제공**

T: 회수  
F: 회수안함

DEFAULT F

 |
| show\_shipping\_address | 

배송지 정보 표기 여부

T: 배송지 정보 표기  
F: 배송지 정보 가림

 |

Update an order status

*   [Update an order status](#none)
*   [Update status of the order to prepare for shipment](#none)
*   [Update status of the order to hold shipment](#none)
*   [Remove the order from held off shipping](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders autocalculation

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20autocalculation.png)  
  
자동금액 계산(autocalculation)은 취소/교환/반품시 할인 금액 등 주문 단위의 금액을 자동으로 배분해주는 기능입니다.  
해당 리소스에서는 특정 주문에 대해 자동금액 계산을 해제할 수 있습니다.

> Endpoints

```
DELETE /api/v2/admin/orders/{order_id}/autocalculation
```

#### \[더보기 상세 내용\]

### Orders autocalculation property list[](#orders__autocalculation-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| order\_id | 

주문번호

 |

### Remove auto calculation setting of an order [](#remove-auto-calculation-setting-of-an-order)cafe24

DELETE /api/v2/admin/orders/{order\_id}/autocalculation

###### DELETE

특정 주문에 자동금액 계산을 해제하여 취소/교환/반품이 가능하도록 할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |

Remove auto calculation setting of an order

*   [Remove auto calculation setting of an order](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders buyer

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20benefits.png)  
  
주문자(Buyer)는 쇼핑몰의 상품을 주문한 사람을 나타냅니다.  
주문자 리소스를 통해 특정 주문의 주문자의 이름, 주소, 전화번호, 이메일 등의 정보를 조회하거나 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orders/{order_id}/buyer
PUT /api/v2/admin/orders/{order_id}/buyer
```

#### \[더보기 상세 내용\]

### Orders buyer property list[](#orders__buyer-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| member\_id | 

회원아이디

 |
| member\_group\_no | 

주문당시 주문자 회원 등급 번호

 |
| name | 

주문자명

 |
| names\_furigana | 

주문자 이름 후리가나

 |
| email | 

주문자 이메일

해당 회원의 이메일

 |
| phone | 

주문자 일반 전화

 |
| cellphone | 

주문자 휴대 전화

 |
| customer\_notification | 

고객 알림

고객에게 알릴 문구

 |
| updated\_date | 

수정일

 |
| user\_id | 

주문자 수정자 ID

주문자정보를 수정한 사람의 ID

 |
| user\_name | 

주문자 수정자 명

주문자정보를 수정한 사람의 이름

 |
| company\_name | 

상호명

 |
| company\_registration\_no | 

사업자등록번호

 |
| buyer\_zipcode | 

주문자 우편번호

 |
| buyer\_address1 | 

주문자 기본주소

 |
| buyer\_address2 | 

주문자 상세주소

 |
| order\_id  

_주문번호_

 | 

주문번호

 |

### Retrieve customer details of an order [](#retrieve-customer-details-of-an-order)cafe24 youtube

GET /api/v2/admin/orders/{order\_id}/buyer

###### GET

특정 주문의 주문자 정보를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |

Retrieve customer details of an order

*   [Retrieve customer details of an order](#none)
*   [Retrieve buyer with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update customer information of an order [](#update-customer-information-of-an-order)cafe24 youtube

PUT /api/v2/admin/orders/{order\_id}/buyer

###### PUT

특정 주문의 주문자 정보를 수정할 수 있습니다.  
주문자명, 주문자 휴대 전화 등을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| name | 

주문자명

 |
| email  

_이메일_

 | 

주문자 이메일

해당 회원의 이메일

 |
| phone | 

주문자 일반 전화

 |
| cellphone | 

주문자 휴대 전화

 |
| customer\_notification | 

고객 알림

고객에게 알릴 문구

 |

Update customer information of an order

*   [Update customer information of an order](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders buyer history

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Orders%20buyer%20history.png)  
  
주문자 수정 이력(Buyer History)은 특정 주문의 주문자 정보가 수정된 이력을 나타냅니다.  
주문자 정보가 수정될 때마다 이력이 추가됩니다.  
주문자 수정 이력 리소스를 통해 특정 주문의 주문자 정보가 수정된 내역을 확인할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orders/{order_id}/buyer/history
```

#### \[더보기 상세 내용\]

### Orders buyer history property list[](#orders__buyer-history-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| name | 

주문자명

 |
| email  

_이메일_

 | 

주문자 이메일

 |
| phone | 

주문자 일반 전화

 |
| cellphone | 

주문자 휴대 전화

 |
| customer\_notification | 

고객 알림

 |
| updated\_date | 

수정일

 |
| user\_id | 

주문자 수정자 ID

 |
| user\_name | 

주문자 수정자 명

 |

### Retrieve a list of customer history of an order [](#retrieve-a-list-of-customer-history-of-an-order)cafe24 youtube

GET /api/v2/admin/orders/{order\_id}/buyer/history

###### GET

특정 주문의 주문자 수정 이력을 조회할 수 있습니다.  
주문자명, 주문자 이메일, 휴대전화 정보등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |

Retrieve a list of customer history of an order

*   [Retrieve a list of customer history of an order](#none)
*   [Retrieve history with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders cancellation

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20cancellation.png)  
  
주문 취소(Orders cancellation) 는 배송 전의 특정 주문 하나를 취소 처리할 수 있는 기능입니다.  
해당 API를 사용하여 취소완료처리할 경우 환불완료 처리와 함께 PG 취소도 같이 진행할 수 있습니다.(payment\_gateway\_cancel : "T"로 요청시)

> Endpoints

```
POST /api/v2/admin/orders/{order_id}/cancellation
PUT /api/v2/admin/orders/{order_id}/cancellation/{claim_code}
```

#### \[더보기 상세 내용\]

### Orders cancellation property list[](#orders__cancellation-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| status | 

주문상태

canceled : 취소완료  
canceling : 취소처리중

 |
| claim\_code | 

취소번호

 |
| items | 

품주코드

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

 |
| undone | 

철회 여부

T : 철회함  
F : 철회안함

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

 |
| undone\_reason\_type | 

철회 사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| undone\_reason | 

철회 사유

 |
| expose\_order\_detail | 

주문상세내역 노출 여부

T : 노출함  
F : 노출안함

 |
| exposed\_undone\_reason | 

주문상세내역 노출 철회 사유

 |

### Create an order cancellation [](#create-an-order-cancellation)cafe24 youtube

POST /api/v2/admin/orders/{order\_id}/cancellation

###### POST

배송 전의 특정 주문을 취소할 수 있습니다.  
해당 API를 사용하여 취소할 경우 환불완료 처리와 함께 PG취소도 같이 진행할 수 있습니다.  
부분취소할 경우 각 환불 금액은 자동 계산되어 환불처리 됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| payment\_gateway\_cancel | 

PG 취소 요청 여부

주문을 취소함과 동시에 PG취소도 같이 처리할 수 있다.  
  
PG취소가 가능한 결제수단(신용카드, 실시간계좌이체)에서만 사용 가능하다.  
  
결제수단이 복수인 주문(카드 등으로 결제한 주문을 결제 후 품목을 추가한 경우)의 경우에는 PG 결제를 취소할 수 없으며 관리자 화면에서 취소해야 한다.  
  
오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가

T : 취소함  
F : 취소안함

DEFAULT F

 |
| **status**  
**Required** | 

주문상태

accepted: 취소접수  
canceling : 취소처리중  
canceled : 취소완료

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

DEFAULT F

 |
| recover\_coupon | 

쿠폰 복원

오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가

T : 복구함  
F : 복구안함

DEFAULT F

 |
| recover\_coupon\_no | 

복원할 쿠폰 번호

 |
| add\_memo\_too | 

관리자 메모에도 추가

오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가

T : 사용함  
F : 사용안함

DEFAULT F

 |
| reason  

_최대글자수 : \[2000자\]_

 | 

취소사유

 |
| claim\_reason\_type | 

취소사유 구분

오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가

A : 고객변심  
B : 배송지연  
C : 배송불가지역  
L : 수출/통관 불가  
D : 포장불량  
E : 상품불만족  
F : 상품정보상이  
G : 서비스불만족  
H : 품절  
I : 기타

 |
| naverpay\_cancel\_reason\_type | 

네이버페이 취소사유 구분

쇼핑몰/오픈마켓/카카오페이 주문을 취소할 경우 사용 불가

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

51 : 구매 의사 취소  
52 : 색상 및 사이즈 변경  
53 : 다른 상품 잘못 주문  
54 : 서비스 및 상품 불만족  
55 : 배송 지연  
56 : 상품 품절  
60 : 상품 정보 상이

 |
| kakaopay\_cancel\_reason\_type | 

카카오페이 취소사유 구분

오픈마켓/네이버페이 주문을 취소할 경우 사용 불가

K1 : 변심에 의한 상품 취소  
K2 : 다른 옵션이나 상품을 잘못 주문함  
K3 : 배송지연  
K4 : 상품 파손 또는 불량  
K5 : 다른 상품 오배송 또는 구성품 누락  
K6 : 상품정보와 다름  
K7 : 품절로 인한 배송 불가

 |
| refund\_method\_code | 

환불 방식

(오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가)

T : 현금  
F : 신용카드  
M : 적립금  
G : 계좌이체  
C : 휴대폰  
D : 예치금  
Z : 후불  
O : 선불금  
V : 편의점  
J : 제휴상품권  
K : 제휴포인트  
I : 기타

 |
| refund\_bank\_code | 

환불 은행 코드

환불 방식(refund\_method)이 현금(T)일 경우 필수  
  
[refund\_bank\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/refund_bank_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)  
  
해당 쇼핑몰이 EC Korea 쇼핑몰일 경우 필수  
환불수단(refund\_method)이 "현금(T)"일 때만 사용 가능  
오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가

 |
| refund\_bank\_name  

_최대글자수 : \[250자\]_

 | 

환불은행명

환불 방식(refund\_method)이 현금(T)일 경우 필수  
  
※ 해당 쇼핑몰이 EC Global 쇼핑몰일 경우 필수  
환불수단(refund\_method)이 "현금(T)"일 때만 사용 가능  
오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가

 |
| refund\_bank\_account\_no | 

환불 계좌번호

환불 방식(refund\_method)이 현금(T)일 경우 필수  
오픈마켓/네이버페이/카카오페이 주문을 취소할 경우 사용 불가

 |
| refund\_bank\_account\_holder  

_최대글자수 : \[15자\]_

 | 

환불계좌 예금주 명의

 |
| items | 

품주코드

 |
| 

items 하위 요소 보기

**order\_item\_code**  
**Required**  
품주코드

**quantity**  
**Required**  
수량







 |

Create an order cancellation

*   [Create an order cancellation](#none)
*   [Cancel the order](#none)
*   [Cancel specific item of the order](#none)
*   [Cancel the order with cancellation request to payment gateway](#none)
*   [Cancel the order and refund to card and cash](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Change cancellation details [](#change-cancellation-details)cafe24 youtube

PUT /api/v2/admin/orders/{order\_id}/cancellation/{claim\_code}

###### PUT

주문의 취소접수를 철회할 수 있습니다.  
취소가 접수된 주문의 주문상태를 취소접수 이전의 상태로 수정할 수 있습니다.  
주문의 취소접수를 철회를 통해 취소접수를 철회하고 재고를 복구하거나 철회사유를 입력할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **claim\_code**  
**Required** | 

취소번호

 |
| status | 

주문상태

canceling : 취소처리중

 |
| **recover\_inventory**  
**Required** | 

재고복구

T : 복구함  
F : 복구안함

 |
| **undone**  
**Required** | 

철회 여부

T : 철회함

 |
| **add\_memo\_too**  
**Required** | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

 |
| **undone\_reason\_type**  
**Required** | 

철회 사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| undone\_reason  

_최대글자수 : \[2000자\]_

 | 

철회 사유

 |
| **expose\_order\_detail**  
**Required** | 

주문상세내역 노출 여부

T : 노출함  
F : 노출안함

 |
| exposed\_undone\_reason  

_최대글자수 : \[2000자\]_

 | 

주문상세내역 노출 철회 사유

 |

Change cancellation details

*   [Change cancellation details](#none)
*   [Withdraw the cancenllation](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders exchange

주문 교환(Orders exchange)은 주문의 교환 접수 상태와 관련된 기능입니다.  
특정 주문에 대해 교환 접수를 할 수 있으며 교환이 접수된 주문의 상태를 수정할 수 있습니다.

> Endpoints

```
POST /api/v2/admin/orders/{order_id}/exchange
PUT /api/v2/admin/orders/{order_id}/exchange/{claim_code}
```

#### \[더보기 상세 내용\]

### Orders exchange property list[](#orders__exchange-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| status | 

주문상태

accept : 접수  
collected : 수거완료  
exchanged : 교환완료

 |
| claim\_code | 

교환번호

 |
| items | 

품주코드

 |
| exchanged\_items | 

교환상품

 |
| pickup\_completed | 

수거완료 여부

T : 수거완료  
F : 수거전

 |
| return\_invoice\_no  

_최대글자수 : \[40자\]_

 | 

반품 송장 번호

 |
| return\_shipping\_company\_name  

_최대글자수 : \[30자\]_

 | 

반품 배송업체명

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

 |
| exchanged\_after\_collected | 

수거완료시 교환완료 여부

T : 사용함  
F : 사용안함

 |
| request\_pickup | 

수거신청 여부

T : 사용함  
F : 사용안함

 |
| pickup | 

수거지역 상세

 |
| undone | 

철회 여부

T : 철회함  
F : 철회안함

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

 |
| undone\_reason\_type | 

철회 사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| undone\_reason | 

철회 사유

 |
| expose\_order\_detail | 

주문상세내역 노출 여부

T : 노출함  
F : 노출안함

 |
| exposed\_undone\_reason | 

주문상세내역 노출 철회 사유

 |
| carrier\_id | 

배송사 아이디

 |
| return\_invoice\_success | 

반송장 처리 성공 여부

T : 성공  
F : 실패  
N : 미집하

 |
| return\_invoice\_fail\_reason  

_최대글자수 : \[100자\]_

 | 

반송장 처리 실패 사유

 |

### Create an order exchange [](#create-an-order-exchange)cafe24 youtube

POST /api/v2/admin/orders/{order\_id}/exchange

###### POST

주문을 교환 접수 처리합니다.  
동일상품교환 여부와 재고복구 상태를 입력할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| **status**  
**Required** | 

주문상태

accepted : 교환접수  
exchanged : 교환완료

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

DEFAULT F

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

DEFAULT F

 |
| items | 

품주코드

 |
| 

items 하위 요소 보기

**order\_item\_code**  
**Required**  
품주코드

**quantity**  
**Required**  
수량

**exchange\_variant\_code**  
(동일상품 다른 옵션 교환시) 교환 상품 품목 코드







 |
| **same\_product**  
**Required** | 

동일상품교환 여부

T : 동일상품교환  
F : 다른상품교환

 |

Create an order exchange

*   [Create an order exchange](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update an order exchange [](#update-an-order-exchange)cafe24 youtube

PUT /api/v2/admin/orders/{order\_id}/exchange/{claim\_code}

###### PUT

교환이 접수된 주문의 상태를 수정할 수 있습니다.  
단건의 주문에 대해 교환접수를 철회하고 재고를 복구하거나 철회사유를 입력할 수 있습니다.  
택배사에 이미 수거요청이 전달되었으나 수거가 필요하지 않게 될 경우, 택배사에 직접 연락하셔서 수거요청을 취소해주셔야 합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **claim\_code**  
**Required** | 

교환번호

 |
| status | 

주문상태

exchanged : 교환완료

 |
| pickup\_completed | 

수거완료 여부

T : 수거완료  
F : 수거전

 |
| return\_invoice\_no  

_최대글자수 : \[40자\]_

 | 

반품 송장 번호

 |
| return\_shipping\_company\_name  

_최대글자수 : \[30자\]_

 | 

반품 배송업체명

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

 |
| exchanged\_after\_collected | 

수거완료시 교환완료 여부

T : 사용함  
F : 사용안함

 |
| items | 

품주코드

 |
| 

items 하위 요소 보기

**order\_item\_code**  
품주코드







 |
| request\_pickup | 

수거신청 여부

T : 사용함  
F : 사용안함

 |
| pickup | 

수거지역 상세

 |
| 

pickup 하위 요소 보기

**name**  
이름

**phone**  
전화번호

**cellphone**  
휴대전화

**zipcode**  
우편번호

**address1**  
기본 주소

**address2**  
상세 주소







 |
| undone | 

철회 여부

T : 철회함

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

 |
| undone\_reason\_type | 

철회 사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| undone\_reason  

_최대글자수 : \[2000자\]_

 | 

철회 사유

 |
| expose\_order\_detail | 

주문상세내역 노출 여부

T : 노출함  
F : 노출안함

 |
| exposed\_undone\_reason  

_최대글자수 : \[2000자\]_

 | 

주문상세내역 노출 철회 사유

 |
| carrier\_id | 

배송사 아이디

 |
| return\_invoice\_success | 

반송장 처리 성공 여부

T : 성공  
F : 실패  
N : 미집하

 |
| return\_invoice\_fail\_reason  

_최대글자수 : \[100자\]_

 | 

반송장 처리 실패 사유

 |

Update an order exchange

*   [Update an order exchange](#none)
*   [Update pickup status for exchange](#none)
*   [Withdraw the exchange](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders exchangerequests

교환 처리를 요청한 주문의 교환접수를 거부할 수 있습니다.

> Endpoints

```
PUT /api/v2/admin/orders/{order_id}/exchangerequests
```

#### \[더보기 상세 내용\]

### Orders exchangerequests property list[](#orders__exchangerequests-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| undone | 

접수거부 여부

 |
| order\_item\_code | 

품주코드

 |
| additional\_payment\_gateway\_cancel | 

추가 PG 취소

 |

### Reject an exchange request [](#reject-an-exchange-request)cafe24 youtube

PUT /api/v2/admin/orders/{order\_id}/exchangerequests

###### PUT

교환 처리를 요청한 주문의 교환 접수를 거부합니다.  
교환신청번호, 거부 사유 등을 필수로 입력합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| **order\_item\_code**  
**Required** | 

품주코드

 |
| **undone**  
**Required** | 

접수거부 여부

T : 접수거부함

 |
| reason\_type | 

사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| reason  

_최대글자수 : \[2000자\]_

 | 

사유

 |
| display\_reject\_reason | 

주문상세내역 노출설정

T : 노출함  
F : 노출안함

DEFAULT F

 |
| reject\_reason  

_최대글자수 : \[2000자\]_

 | 

거부 사유

고객에게 노출되는 접수 거부 사유

 |

Reject an exchange request

*   [Reject an exchange request](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders items

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20items.png)  
  
품주(Items)는 쇼핑몰 고객이 주문할 때 구매한 품목 정보입니다.  
쇼핑몰의 품목은 쇼핑몰에서 판매하는 상품의 기본 단위로, 품주에는 구입한 상품의 품목 정보와 더불어, 구매시 선택한 옵션, 주문 수량 등의 정보를 추가로 확인할 수 있습니다.  
품주는 하위 리소스로서 주문(Order) 하위에서만 사용할 수 있습니다.  
품주의 조회와 상태변경, 취소/교환/반품 요청 사유 등의 입력과 수정이 가능합니다.

> Endpoints

```
GET /api/v2/admin/orders/{order_id}/items
POST /api/v2/admin/orders/{order_id}/items
PUT /api/v2/admin/orders/{order_id}/items/{order_item_code}
```

#### \[더보기 상세 내용\]

### Orders items property list[](#orders__items-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| item\_no | 

품주 아이디

품목별 주문번호의 아이디

 |
| order\_item\_code | 

품주코드

품목별 주문번호의 코드

 |
| variant\_code | 

품목코드

시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않음.

 |
| product\_no | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| product\_code | 

상품코드

시스템이 상품에 부여한 코드. 해당 쇼핑몰 내에서 상품코드는 중복되지 않음.

 |
| internal\_product\_name | 

상품명(관리용)

 |
| custom\_product\_code  

_최대글자수 : \[40자\]_

 | 

자체상품 코드

 |
| custom\_variant\_code | 

자체 품목 코드

 |
| eng\_product\_name | 

영문 상품명

상품의 영문 이름. 해외 배송 등에 사용 가능함.

 |
| option\_id | 

상품옵션 아이디

상품옵션의 아이디

 |
| option\_value | 

옵션값

주문한 상품의 옵션값

 |
| option\_value\_default | 

기본옵션값

 |
| additional\_option\_value | 

추가입력 옵션 값

 |
| additional\_option\_values | 

추가입력 옵션 목록

 |
| product\_name | 

상품명

상품의 이름. 상품명은 상품을 구분하는 가장 기초적인 정보이며 검색 정보가 됨.

 |
| product\_name\_default | 

기본 상품명

 |
| product\_price | 

상품 판매가

상품의 판매가. 멀티쇼핑몰 운영 시에는 판매가를 쇼핑별 화폐단위로 환산하여 보여줌.

 |
| option\_price | 

옵션 추가 가격

옵션별로 해당하는 추가 가격이 있을 경우 그 추가가격.

 |
| additional\_discount\_price | 

상품추가할인액

상품에 대한 추가 할인금액

 |
| coupon\_discount\_price | 

상품별 쿠폰 할인금액

 |
| app\_item\_discount\_amount | 

앱 상품할인금액

 |
| payment\_amount | 

품목별 결제금액

쇼핑몰설정 > 주문설정 > 주문 후 설정 > 입금/환불/반품처리 설정 > 취소/교환/반품 접수 시 할인/적립 금액 설정 : 할인금액 자동계산(설정한 이후 접수된 주문부터 적용)  
위 옵션을 설정하지 않은 경우 값이 null로 반환됩니다.

 |
| quantity | 

수량

주문한 상품의 수량

 |
| product\_tax\_type | 

상품 세금 구분

A : 과세  
B : 면세  
C : 비과세

 |
| tax\_rate | 

과세율

 |
| supplier\_product\_name | 

공급사 상품명

공급사의 상품명

 |
| supplier\_transaction\_type | 

공급사 거래 유형

공급사의 거래 유형

D: 직등록형  
P: 수수료형

 |
| supplier\_id | 

공급사 아이디

공급사의 아이디

 |
| supplier\_name | 

공급사명

공급사의 이름

 |
| tracking\_no | 

송장번호

 |
| shipping\_code | 

배송번호

배송번호. 품목별 주문번호를 배송준비중으로 처리하면 시스템이 자동으로 부여하는 번호.

 |
| claim\_code | 

취소/교환/반품 번호

 |
| claim\_reason\_type | 

취소/교환/반품 요청 사유 타입

구매자의 취소/교환/반품 신청 사유 구분.  
판매자의 접수 사유는 각 취소/교환/반품 리소스의 claim\_reason\_type으로 조회할 수 있다.

구매자 취소 신청  
A:고객변심  
G:서비스불만족  
B:배송지연  
I:기타  
  
구매자 교환/반품 신청  
O:고객변심  
P:상품 불만족  
V:상품불량  
W:배송오류  
  
판매자 취소/교환/반품 신청  
A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| claim\_reason | 

취소/교환/반품 요청 사유

구매자의 취소/교환/반품 신청 사유 상세 내용.  
판매자의 접수 사유는 각 취소/교환/반품 리소스의 claim\_reason으로 조회할 수 있다.

 |
| refund\_bank\_name | 

환불은행명

 |
| refund\_bank\_account\_no | 

환불 계좌번호

 |
| refund\_bank\_account\_holder | 

환불계좌 예금주 명의

 |
| post\_express\_flag | 

우체국 택배연동

우체국 택배연동 상태

 |
| order\_status | 

주문상태

주문상태. 주문 상태별로 각각의 코드가 있음.

 |
| request\_undone | 

철회상태

Cancellation : 취소철회  
Exchange : 교환철회  
Return : 반품철회

 |
| order\_status\_additional\_info | 

주문상태 추가정보

주문상태의 추가정보

 |
| claim\_quantity | 

취소/교환/반품 요청 수량

 |
| status\_code | 

현재 처리상태 코드

현재 처리상태의 코드

N1 : 정상  
N2 : 교환상품  
C1 : 입금전취소  
C2 : 배송전취소  
C3 : 반품  
E1 : 교환

 |
| status\_text | 

현재 처리상태

현재 처리상태 문구설명

 |
| open\_market\_status | 

마켓연동 상태값

 |
| bundled\_shipping\_type | 

묶음배송 타입

배송 대상 주문건의 묶음배송 유형

N : 단일 주문 일반 배송(Normal)  
C :복합 주문 결합 배송(Combination)

 |
| shipping\_company\_id | 

배송업체 아이디

배송업체의 아이디

 |
| shipping\_company\_name | 

배송업체 이름

배송업체의 이름

 |
| shipping\_company\_code | 

배송업체 코드

[shipping\_company\_code](https://s3.ap-northeast-2.amazonaws.com/appservice-guide/resource/ko/shipping_company_code_kr.csv) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| product\_bundle | 

세트상품 여부

T : 세트상품  
F : 세트상품 아님

 |
| product\_bundle\_no | 

세트상품번호

분리형 세트상품의 번호  
일체형 세트 상품의 번호는 product\_no에서 표시됨.

 |
| product\_bundle\_name | 

세트상품명

분리형 세트상품의 이름  
일체형 세트 상품의 이름은 product\_name에서 표시됨

 |
| product\_bundle\_name\_default | 

세트상품명(기본)

분리형 세트상품의 이름  
일체형 세트 상품의 이름은 product\_name에서 표시됨

 |
| product\_bundle\_type | 

세트상품 타입

세트상품의 타입

C : 일체형  
S : 분리형

 |
| was\_product\_bundle | 

세트품주 분리여부

세트상품의 품목주문번호 분리 여부

T : 분리되었던 적이 있음

 |
| original\_bundle\_item\_no | 

분리된 세트상품의 기존 품주번호

분리형 세트 상품의 기존 품목 번호

 |
| naver\_pay\_order\_id | 

네이버페이 상품별 주문번호

네이버페이 주문의 상품별 주문번호

 |
| naver\_pay\_claim\_status | 

네이버페이 클레임 타입

네이버페이 주문의 클레임 타입

PAYMENT\_WAITING : 입금대기  
PAYED : 결제완료  
DELIVERING : 배송중  
DELIVERED : 배송완료  
PURCHASE\_DECIDED : 구매확정  
EXCHANGED : 교환  
CANCELED : 취소  
RETURNED : 반품  
CANCELED\_BY\_NOPAYMENT : 미입금취소  
NOT\_YET : 발주 미확인  
OK : 발주 확인  
CANCEL : 발주 확인 해제  
CANCEL\_REQUEST : 취소요청  
CANCELING : 취소처리중  
CANCEL\_DONE : 취소처리완료  
CANCEL\_REJECT : 취소철회  
RETURN\_REQUEST : 반품요청  
COLLECTING : 수거처리중  
COLLECT\_DONE : 수거완료  
RETURN\_DONE : 반품완료  
RETURN\_REJECT : 반품철회  
EXCHANGE\_REQUEST : 교환요청  
COLLECTING : 수거처리중  
COLLECT\_DONE : 수거완료  
EXCHANGE\_REDELIVERING : 교환 재배송 중  
EXCHANGE\_DONE : 교환완료  
EXCHANGE\_REJECT : 교환거부  
PURCHASE\_DECISION\_HOLDBACK : 구매 확정 보류  
PURCHASE\_DECISION\_HOLDBACK\_REDELIVERING : 구매 확정 보류 재배송 중  
PURCHASE\_DECISION\_REQUEST : 구매 확정 요청  
PURCHASE\_DECISION\_HOLDBACK\_RELEASE : 구매 확정 보류 해제  
ADMIN\_CANCELING : 직권 취소 중  
ADMIN\_CANCEL\_DONE : 직권 취소 완료

 |
| individual\_shipping\_fee | 

개별배송비

개별 배송비

 |
| shipping\_fee\_type | 

배송비 타입

(개별배송비를 사용할 경우) 상품의 배송비 타입.  
shipping\_calculation이 A(자동계산)일 경우 null로 반환.

T : 무료  
F : 착불  
D : 차등(금액)  
M : 조건(금액)  
I : 고정  
N : 비례(수량)  
W : 차등(무게)  
C : 차등(수량)  
X : 기본배송

 |
| shipping\_fee\_type\_text | 

배송비타입

배송비 타입 설명

 |
| shipping\_payment\_option | 

선/착불 구분

C : 착불  
P : 선결제  
F : 무료

 |
| payment\_info\_id | 

결제정보 아이디

 |
| original\_item\_no | 

기존 품주 아이디

 |
| store\_pickup | 

매장수령여부

매장수령 상품 여부

T : 매장수령  
F : 매장수령 아님

 |
| ordered\_date | 

주문일

 |
| shipped\_date | 

배송시작일

배송 시작일

 |
| delivered\_date | 

배송완료일

배송 완료일

 |
| purchaseconfirmation\_date | 

구매확정일

 |
| cancel\_date | 

주문취소일

주문 취소일

 |
| return\_confirmed\_date | 

반품승인일시

 |
| return\_request\_date | 

반품요청일

반품 요청일

 |
| return\_collected\_date | 

반품수거일

 |
| cancel\_request\_date | 

취소요청일

주문취소 요청일

 |
| refund\_date | 

환불완료일

환불 완료일

 |
| exchange\_request\_date | 

교환요청일

교환 요청일

 |
| exchange\_date | 

교환완료일

교환 완료일

 |
| product\_material | 

상품소재

상품의 소재. 복합 소재일 경우 상품의 소재와 함유랑을 함께 입력해야함. (예 : 면 80%, 레이온 20%)

 |
| product\_material\_eng | 

영문 상품 소재

상품소재 영문 설명

 |
| cloth\_fabric | 

옷감

상품이 의류인 경우, 옷감. 일본 택배사를 이용할 경우, 택배사에 따라 의류 통관시 옷감 정보를 입력 받는 경우가 있음.

 |
| product\_weight | 

상품 중량

상품의 전체 중량(kg). 배송을 위해 상품 자체의 무게와 박스 무게, 포장무게를 모두 포함한 중량 기재가 필요하다.

 |
| volume\_size | 

상품 부피

상품의 부피

 |
| volume\_size\_weight | 

상품 부피 무게

상품의 부피 무게

 |
| clearance\_category | 

해외통관용 상품구분

 |
| clearance\_category\_info | 

해외통관용 상품정보

 |
| clearance\_category\_code | 

해외통관코드

[clearance\_category\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/clearance_category_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| hs\_code | 

HS코드

통관을 위한 hs 코드

 |
| one\_plus\_n\_event | 

1+N이벤트 여부

1개 구매시 N개 증정하는 이벤트 여부

 |
| origin\_place | 

원산지정보

상품의 원산지

 |
| origin\_place\_no | 

원산지 코드

 |
| made\_in\_code | 

원산지 국가코드

 |
| origin\_place\_value | 

원산지기타정보

 |
| gift | 

사은품 여부

상품이 사은품인지 여부

T : 사은품  
F : 사은품 아님

 |
| item\_granting\_gift | 

사은품증정 조건품주목록

 |
| subscription | 

정기결제 여부

T : 정기결제  
F : 정기결제 아님

 |
| product\_bundle\_list | 

세트상품 목록

 |
| market\_cancel\_request | 

마켓 취소요청 여부

T : 취소 요청된 마켓 주문  
F : 취소 요청되지 않은 마켓 주문

 |
| market\_cancel\_request\_quantity | 

마켓 취소신청 수량

 |
| market\_fail\_reason | 

마켓 실패사유

 |
| market\_fail\_reason\_guide | 

마켓 실패사유 가이드

 |
| market\_fail\_reason\_type | 

마켓 실패사유 타입

S : 마켓전송실패  
C : 마켓취소실패

 |
| market\_item\_no | 

외부 품목별 번호

 |
| market\_custom\_variant\_code | 

마켓 자체 품목 코드

 |
| option\_type | 

옵션 구성방식

T : 조합형  
E : 연동형  
F : 독립형

 |
| options | 

옵션

 |
| market\_discount\_amount | 

상품별 마켓 할인금액

 |
| labels | 

주문 라벨

 |
| order\_status\_before\_cs | 

CS 전 주문상태

 |
| supply\_price | 

상품 공급가

 |
| multi\_invoice | 

멀티 송장

 |
| shipping\_expected\_date | 

발송예정일

 |
| order\_id | 

주문번호

 |
| claim\_type | 

취소/교환/반품 타입

 |
| claim\_status | 

취소/교환/반품 요청 상태

 |

### Retrieve a list of order items [](#retrieve-a-list-of-order-items)cafe24 youtube

GET /api/v2/admin/orders/{order\_id}/items

###### GET

주문의 모든 품주를 조회할 수 있습니다.  
품주코드, 상품번호, 자체 품목 코드 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| supplier\_id | 

공급사 아이디

,(콤마)로 여러 건을 검색할 수 있다.

 |

Retrieve a list of order items

*   [Retrieve a list of order items](#none)
*   [Retrieve items with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create an order item [](#create-an-order-item)cafe24 youtube

POST /api/v2/admin/orders/{order\_id}/items

###### POST

특정 주문의 세트 품주를 나눔처리할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| was\_product\_bundle | 

세트품주 분리여부

T : 세트상품 나눔  
F : 세트상품 나눔 안함

DEFAULT F

 |
| original\_bundle\_item\_no | 

분리된 세트상품의 기존 품주번호

 |
| **variant\_code**  
**Required**  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

품목코드

 |

Create an order item

*   [Create an order item](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update an order item [](#update-an-order-item)cafe24 youtube

PUT /api/v2/admin/orders/{order\_id}/items/{order\_item\_code}

###### PUT

주문의 품주 1개에 대한 주문상태를 수정할 수 있습니다.  
품주를 취소/교환/반품으로 상태를 변경하고 사유를 입력할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **order\_item\_code**  
**Required** | 

품주코드

 |
| claim\_type | 

취소/교환/반품 타입

※ 사용시 "claim\_type" "claim\_status" "claim\_reason\_type"은 필수값 입니다.

C:취소  
R:반품

 |
| claim\_status | 

취소/교환/반품 요청 상태

※ 사용시 "claim\_type" "claim\_status" "claim\_reason\_type"은 필수값 입니다.

T : 신청함  
F : 신청안함

 |
| claim\_reason\_type | 

취소/교환/반품 요청 사유 타입

※ 사용시 "claim\_type" "claim\_status" "claim\_reason\_type"은 필수값 입니다.

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| claim\_reason | 

취소/교환/반품 요청 사유

※ 사용시 "claim\_type" "claim\_status" "claim\_reason\_type"은 필수값 입니다.

 |
| claim\_quantity | 

취소/교환/반품 요청 수량

※ 사용시 "claim\_type" "claim\_status" "claim\_reason\_type"은 필수값 입니다.

 |
| multi\_invoice | 

멀티 송장

**Youtube shopping 이용 시에는 미제공**

※ 멀티 송장 수정시 "claim\_type" "claim\_status" "claim\_reason\_type", "claim\_quantity", "claim\_quantity"은 사용 불가합니다.  
※ 메인송장의 송장번호와 배송업체 코드는 shipments 에서만 수정이 가능하고 배송처리 이후부터는 수정만 가능하며 추가/삭제는 안됩니다.  
※ 멀티 송장에는 연동 배송업체를 입력할 수 없습니다.  
※ 해당 속성에 대한 어드민 UI는 24년 7월 8일부터 확인 가능합니다.

 |
| 

multi\_invoice 하위 요소 보기

**tracking\_no**  
송장번호

**shipping\_company\_id**  
배송업체 아이디

**quantity**  
수량







 |
| shipping\_expected\_date | 

발송예정일

 |

Update an order item

*   [Update an order item](#none)
*   [Request for returning product](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders items labels

원하는 주문 품목에 라벨을 남기거나 조회, 수정, 삭제할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orders/{order_id}/items/{order_item_code}/labels
POST /api/v2/admin/orders/{order_id}/items/{order_item_code}/labels
PUT /api/v2/admin/orders/{order_id}/items/{order_item_code}/labels
DELETE /api/v2/admin/orders/{order_id}/items/{order_item_code}/labels/{name}
```

#### \[더보기 상세 내용\]

### Orders items labels property list[](#orders__items__labels-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| names | 

주문 라벨명

 |
| order\_id | 

주문번호

 |
| order\_item\_code | 

품주코드

 |
| name | 

주문 라벨명

 |

### Retrieve an order label [](#retrieve-an-order-label)cafe24

GET /api/v2/admin/orders/{order\_id}/items/{order\_item\_code}/labels

###### GET

특정 주문 품목의 라벨목록을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| **order\_item\_code**  
**Required** | 

품주코드

 |

Retrieve an order label

*   [Retrieve an order label](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create an order label [](#create-an-order-label)cafe24

POST /api/v2/admin/orders/{order\_id}/items/{order\_item\_code}/labels

###### POST

특정 주문 품목에 라벨을 등록할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| **order\_item\_code**  
**Required** | 

품주코드

 |
| **names**  
**Required** | 

주문 라벨명

 |

Create an order label

*   [Create an order label](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update an order label [](#update-an-order-label)cafe24

PUT /api/v2/admin/orders/{order\_id}/items/{order\_item\_code}/labels

###### PUT

특정 주문 품목에 등록된 라벨을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| **order\_item\_code**  
**Required** | 

품주코드

 |
| **names**  
**Required** | 

주문 라벨명

 |

Update an order label

*   [Update an order label](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete an order label [](#delete-an-order-label)cafe24

DELETE /api/v2/admin/orders/{order\_id}/items/{order\_item\_code}/labels/{name}

###### DELETE

특정 주문 품목에 등록된 라벨을 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| **order\_item\_code**  
**Required** | 

품주코드

 |
| **name**  
**Required** | 

주문 라벨명

 |

Delete an order label

*   [Delete an order label](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders items options

주문 품목에 추가입력 옵션을 둥록, 수정, 삭제할 수 있습니다.

> Endpoints

```
POST /api/v2/admin/orders/{order_id}/items/{order_item_code}/options
PUT /api/v2/admin/orders/{order_id}/items/{order_item_code}/options
```

#### \[더보기 상세 내용\]

### Orders items options property list[](#orders__items__options-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| order\_item\_code | 

품주코드

 |
| product\_bundle | 

세트상품 여부

 |
| additional\_options | 

추가입력 옵션

 |
| bundle\_additional\_options | 

세트상품 추가입력 옵션

 |

### Create order item options [](#create-order-item-options)cafe24

POST /api/v2/admin/orders/{order\_id}/items/{order\_item\_code}/options

###### POST

특정 주문 품목에 추가입력 옵션을 둥록할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| **order\_item\_code**  
**Required** | 

품주코드

 |
| **product\_bundle**  
**Required** | 

세트상품 여부

 |
| additional\_options | 

추가입력 옵션

 |
| 

additional\_options 하위 요소 보기

**additional\_option\_name**  
**Required**  
추가입력옵션명

**additional\_option\_value**  
**Required**  
추가입력 옵션 값







 |
| bundle\_additional\_options | 

세트상품 추가입력 옵션

 |
| 

bundle\_additional\_options 하위 요소 보기

**variant\_code**  
**Required**  
품목코드

**additional\_options** _Array_

additional\_options 하위 요소 보기

**additional\_option\_name**  
추가입력옵션명  
**Required**

**additional\_option\_value**  
추가입력 옵션 값  
**Required**













 |

Create order item options

*   [Create order item options](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Edit order item options [](#edit-order-item-options)cafe24

PUT /api/v2/admin/orders/{order\_id}/items/{order\_item\_code}/options

###### PUT

특정 주문 품목에 추가입력 옵션을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| **order\_item\_code**  
**Required** | 

품주코드

 |
| additional\_options | 

추가입력 옵션

 |
| 

additional\_options 하위 요소 보기

**additional\_option\_name**  
**Required**  
추가입력옵션명

**additional\_option\_value**  
**Required**  
추가입력 옵션 값







 |

Edit order item options

*   [Edit order item options](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders memos

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20memos.png)  
  
주문 메모(Orders memos)는 특정 주문의 메모에 대한 주문의 하위 리소스 입니다.  
주문에 대하여 관리자 메모의 조회, 등록, 수정, 삭제를 할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orders/{order_id}/memos
POST /api/v2/admin/orders/{order_id}/memos
PUT /api/v2/admin/orders/{order_id}/memos/{memo_no}
DELETE /api/v2/admin/orders/{order_id}/memos/{memo_no}
```

#### \[더보기 상세 내용\]

### Orders memos property list[](#orders__memos-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| memo\_no | 

메모 번호

 |
| created\_date | 

메모 등록일

 |
| author\_id | 

작성자 아이디

 |
| ip | 

작성자 아이피

 |
| use\_customer\_inquiry | 

고객상담 동시등록 여부

T : 사용함  
F : 사용안함

 |
| attach\_type | 

등록기준

O : 주문별  
P : 품목별

 |
| content | 

메모 내용

 |
| starred\_memo | 

중요 메모 여부

T : 중요 메모  
F : 일반 메모

 |
| fixed | 

상단고정 여부

T : 사용함  
F : 사용안함

 |
| product\_list | 

상품 목록

 |
| topic\_type | 

상담분류

cs\_01 : 배송문의  
cs\_02 : 상품문의  
cs\_03 : 결제문의  
cs\_04 : 주문취소  
cs\_05 : 상품변경

 |
| status | 

상담결과

F : 처리중  
T : 처리완료

 |

### Retrieve a list of order memos [](#retrieve-a-list-of-order-memos)cafe24 youtube

GET /api/v2/admin/orders/{order\_id}/memos

###### GET

특정주문에 대한 메모를 목록으로 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |

Retrieve a list of order memos

*   [Retrieve a list of order memos](#none)
*   [Retrieve memos with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create an order memo [](#create-an-order-memo)cafe24 youtube

POST /api/v2/admin/orders/{order\_id}/memos

###### POST

특정 주문에 메모를 등록할 수 있습니다.  
메모를 등록하면서 중요메모로 표시하거나 주문서 상단에 고정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| **content**  
**Required**  

_최대글자수 : \[1000자\]_

 | 

메모 내용

 |
| use\_customer\_inquiry | 

고객상담 동시등록 여부

T : 사용함  
F : 사용안함

DEFAULT F

 |
| topic\_type | 

상담분류

cs\_01 : 배송문의  
cs\_02 : 상품문의  
cs\_03 : 결제문의  
cs\_04 : 주문취소  
cs\_05 : 상품변경

 |
| status | 

상담결과

F : 처리중  
T : 처리완료

 |
| attach\_type | 

등록기준

O : 주문별  
P : 품목별

DEFAULT O

 |
| starred\_memo | 

중요 메모 여부

T : 중요 메모  
F : 일반 메모

DEFAULT F

 |
| fixed | 

상단고정 여부

T : 사용함  
F : 사용안함

DEFAULT F

 |
| product\_list | 

상품 목록

 |

Create an order memo

*   [Create an order memo](#none)
*   [Post an order memo using only content field](#none)
*   [Try posting an order memo without content field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update an order memo [](#update-an-order-memo)cafe24 youtube

PUT /api/v2/admin/orders/{order\_id}/memos/{memo\_no}

###### PUT

특정 주문에 대한 메모를 수정할 수 있습니다.  
메모내용, 상담분류, 중요 메모 여부, 상단고정 여부 등을 변경할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| **memo\_no**  
**Required** | 

메모 번호

 |
| content  

_최대글자수 : \[1000자\]_

 | 

메모 내용

 |
| use\_customer\_inquiry | 

고객상담 동시등록 여부

T : 사용함  
F : 사용안함

DEFAULT F

 |
| topic\_type | 

상담분류

cs\_01 : 배송문의  
cs\_02 : 상품문의  
cs\_03 : 결제문의  
cs\_04 : 주문취소  
cs\_05 : 상품변경

 |
| status | 

상담결과

F : 처리중  
T : 처리완료

 |
| attach\_type | 

등록기준

O : 주문별  
P : 품목별

DEFAULT O

 |
| starred\_memo | 

중요 메모 여부

T : 중요 메모  
F : 일반 메모

DEFAULT F

 |
| fixed | 

상단고정 여부

T : 사용함  
F : 사용안함

DEFAULT F

 |
| product\_list | 

상품 목록

 |

Update an order memo

*   [Update an order memo](#none)
*   [Change memo to attach product code](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete an order memo [](#delete-an-order-memo)cafe24 youtube

DELETE /api/v2/admin/orders/{order\_id}/memos/{memo\_no}

###### DELETE

특정 주문에 대한 메모를 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| **memo\_no**  
**Required** | 

메모 번호

 |

Delete an order memo

*   [Delete an order memo](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders payments

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20payments.png)  
  
주문의 결제상태(Orders payments)는 특정 주문의 결제상태에 대한 기능입니다.

> Endpoints

```
PUT /api/v2/admin/orders/{order_id}/payments
```

#### \[더보기 상세 내용\]

### Orders payments property list[](#orders__payments-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| change\_payment\_amount | 

결제금액 변경 여부

T : 사용함  
F : 사용안함

 |
| change\_payment\_method | 

결제수단 변경 여부

T : 사용함  
F : 사용안함

 |
| payment\_method | 

결제수단

 |
| payment\_gateway\_failure\_message | 

PG 결제 취소 실패 메시지

 |
| admin\_additional\_amount | 

관리자 입력 금액

 |
| commission | 

결제 수수료

 |
| initial\_estimated\_payment\_amount | 

최초 결제 예정 금액

 |
| change\_payment\_amount\_reason | 

결제금액 변경 사유

 |

### Update an order payment status [](#update-an-order-payment-status)cafe24

PUT /api/v2/admin/orders/{order\_id}/payments

###### PUT

특정 주문의 결제상태를 수정할 수 있습니다.  
결제취소 상태로 변경하고자 할 경우, 앱을 통해 등록된 PG사에서 결제를 취소할 경우에만 사용이 가능합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **change\_payment\_amount**  
**Required** | 

결제금액 변경 여부

입금전 상태에서만 결제금액 변경 가능  
  
단, CS주문상태 또는 CS처리이력이 존재하는 경우에는 결제금액 변경 불가능함  
  
※ 결제수단별 입금전 주문상태  
\- 무통장입금 : 입금전  
\- 다이비키 : 상품준비중 ~ 배송완료 \[다이비키 입금전\]

T : 사용함  
F : 사용안함

 |
| **change\_payment\_method**  
**Required** | 

결제수단 변경 여부

T : 사용함  
F : 사용안함

 |
| payment\_method | 

결제수단

cash: 무통장 입금  
daibiki : 다이비키

 |
| billing\_name  

_최대글자수 : \[40자\]_

 | 

입금자명

결제수단을 무통장입금으로 변경할 경우("change\_payment\_method:"T"이고 "payment\_method":"cash"일 경우) 사용 가능

 |
| bank\_account\_id | 

무통장 입금 은행 ID

결제수단을 무통장입금으로 변경할 경우("change\_payment\_method:"T"이고 "payment\_method":"cash"일 경우) 사용 가능

 |
| admin\_additional\_amount  

_최소값: \[0\]_  
_최대값: \[10000000\]_

 | 

관리자 입력 금액

결제금액을 변경할 경우("change\_payment\_amount":"T"일 경우) 사용 가능

 |
| commission  

_최소값: \[0\]_  
_최대값: \[10000000\]_

 | 

결제 수수료

결제수단을 다이비키로 변경할 경우("change\_payment\_amount:"T"이고 "payment\_method":"daibiki"일 경우) 사용 가능

 |
| change\_payment\_amount\_reason  

_최대글자수 : \[255자\]_

 | 

결제금액 변경 사유

결제금액을 변경할 경우("change\_payment\_amount":"T"일 경우) 사용 가능

 |

Update an order payment status

*   [Update an order payment status](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders paymenttimeline

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20paymenttimeline.png)  
  
주문의 결제타임라인(Orders paymenttimeline)은 특정 주문의 결제에 대한 시간적인 연대표에 대한 기능입니다.

> Endpoints

```
GET /api/v2/admin/orders/{order_id}/paymenttimeline
GET /api/v2/admin/orders/{order_id}/paymenttimeline/{payment_no}
```

#### \[더보기 상세 내용\]

### Orders paymenttimeline property list[](#orders__paymenttimeline-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| payment\_no | 

결제번호

 |
| payment\_settle\_type | 

결제유형

O : 최초결제  
R : 추가결제  
P : 환불

 |
| order\_amount | 

주문금액

 |
| additional\_payment\_amount | 

보조 결제금액

 |
| paid\_amount | 

결제금액

 |
| payment\_methods | 

결제수단

 |
| payment\_datetime | 

결제일

 |
| created\_datetime | 

입력일

 |
| claim\_code | 

취소/교환/반품 번호

 |
| payment\_method\_detail | 

결제수단별 결제금액

[payment\_method\_detail code](https://appservice-guide.s3-ap-northeast-2.amazonaws.com/resource/ko/payment_method_detail_code_list_kr.csv) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| order\_amount\_detail | 

주문금액 상세

[order\_amount\_detail code](https://appservice-guide.s3-ap-northeast-2.amazonaws.com/resource/ko/order_amount_detail_code_list_kr.csv) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |

### Retrieve payment history of an order [](#retrieve-payment-history-of-an-order)cafe24 youtube

GET /api/v2/admin/orders/{order\_id}/paymenttimeline

###### GET

특정 주문의 전체 결제타임라인을 조회할 수 있습니다.  
결제유형, 주문금액, 결제일 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| start\_date  

_날짜_

 | 

검색 시작일

 |
| end\_date  

_날짜_

 | 

검색 종료일

 |
| date\_type | 

검색날짜 유형

시작일과 종료일 기준으로 기간 검색시 date\_type 미입력시 created\_datetime 기준으로 검색 진행

created\_datetime : 입력일  
payment\_datetime : 결제일

 |

Retrieve payment history of an order

*   [Retrieve payment history of an order](#none)
*   [Retrieve paymentstimeline with fields parameter](#none)
*   [Retrieve a specific paymentstimeline with date\_type parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve payment details of an order [](#retrieve-payment-details-of-an-order)cafe24 youtube

GET /api/v2/admin/orders/{order\_id}/paymenttimeline/{payment\_no}

###### GET

특정 주문의 결제번호 1건에 대한 결제타임라인을 조회할 수 있습니다.  
결제유형, 주문금액, 결제금액 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **payment\_no**  
**Required**  

_최소값: \[1\]_

 | 

결제번호

 |

Retrieve payment details of an order

*   [Retrieve payment details of an order](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders receivers

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20receivers.png)  
  
주문수령자 정보(Orders receivers)는 주문한 상품을 배송 받을 수령자의 이름, 연락처, 주소 등의 정보에 대한 기능 입니다.  
수령자 정보는 하위 리소스로서 주문(Order) 하위에서만 사용할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orders/{order_id}/receivers
PUT /api/v2/admin/orders/{order_id}/receivers
PUT /api/v2/admin/orders/{order_id}/receivers/{shipping_code}
```

#### \[더보기 상세 내용\]

### Orders receivers property list[](#orders__receivers-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| name | 

수령자명

 |
| name\_furigana | 

수령자명 (발음)

 |
| phone | 

전화번호

 |
| cellphone | 

수령자 휴대 전화

 |
| virtual\_phone\_no | 

수령자 안심번호

 |
| zipcode | 

우편번호

 |
| address1 | 

기본 주소

 |
| address2 | 

상세 주소

 |
| address\_state | 

주/도

 |
| address\_city | 

시/군/도시

 |
| address\_street | 

도로명

 |
| address\_full | 

전체주소

 |
| name\_en | 

수령자명 (영문)

 |
| city\_en | 

수령자 도시 (영문)

 |
| state\_en | 

수령자 주 (영문)

 |
| street\_en | 

수령자 주소 (영문)

 |
| country\_code | 

국가코드

 |
| country\_name | 

국가명

 |
| country\_name\_en | 

국가명 (영문)

 |
| shipping\_message | 

배송 메세지

 |
| clearance\_information\_type | 

통관정보 유형

I : 신분증 ID  
P : 여권번호  
C : 개인통관고유부호

 |
| clearance\_information | 

통관정보

 |
| wished\_delivery\_date | 

희망배송일

 |
| wished\_delivery\_time | 

희망배송시간

 |
| shipping\_code | 

배송번호

 |
| change\_default\_shipping\_address | 

기본배송지 변경 여부

T : 변경함  
F : 변경안함

 |
| use\_fast\_delivery\_date | 

가능한 빠른 배송일 설정 여부

T: 사용함  
F: 사용안함

 |
| use\_fast\_delivery\_time | 

가능한 빠른 배송시간 설정 여부

T: 사용함  
F: 사용안함

 |

### Retrieve a list of recipients of an order [](#retrieve-a-list-of-recipients-of-an-order)cafe24 youtube

GET /api/v2/admin/orders/{order\_id}/receivers

###### GET

특정 주문의 수령자정보를 목록으로 조회할 수 있습니다.  
수령자명, 휴대전화 번호, 주소 등을 조회할 수 있습니다.  
부분배송이나 분할배송 등의 경우 하나의 주문에 수령자는 여럿일 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| shipping\_code | 

배송번호

,(콤마)로 여러 건을 검색할 수 있다.

 |

Retrieve a list of recipients of an order

*   [Retrieve a list of recipients of an order](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update order recipients [](#update-order-recipients)cafe24 youtube

PUT /api/v2/admin/orders/{order\_id}/receivers

###### PUT

특정 주문의 수령자정보를 수정할 수 있습니다.  
복수 배송지 주문일 경우에는 수령자 안심번호는 수정하실 수 없습니다.  
수령자명, 수령자 휴대 전화 등을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| name  

_최대글자수 : \[20자\]_

 | 

수령자명

 |
| phone  

_최대글자수 : \[20자\]_

 | 

수령자 일반 전화

한국몰일 경우 02-0000-0000 형태로 입력  
그외 해외몰일 경우 국가번호-000-0000 형태로 입력

 |
| cellphone  

_최대글자수 : \[20자\]_

 | 

수령자 휴대 전화

한국몰일 경우 010-0000-0000 형태로 입력  
그외 해외몰일 경우 국가번호-000-0000 형태로 입력

 |
| shipping\_message | 

배송 메세지

 |
| name\_furigana | 

수령자명 (발음)

**Youtube shopping 이용 시에는 미제공**

해외몰 중 일본몰인 경우에만 필수 입력

 |
| zipcode  

_최소글자수 : \[2자\]_  
_최대글자수 : \[14자\]_

 | 

우편번호

 |
| address1  

_최대글자수 : \[255자\]_

 | 

기본 주소

 |
| address2  

_최대글자수 : \[255자\]_

 | 

상세 주소

 |
| address\_state | 

주/도

해외몰인 경우 필수 입력

 |
| address\_city | 

시/군/도시

해외몰인 경우 필수 입력

 |
| name\_en | 

수령자명 (영문)

 |
| city\_en | 

수령자 도시 (영문)

 |
| state\_en | 

수령자 주 (영문)

 |
| street\_en | 

수령자 주소 (영문)

 |
| country\_code | 

국가코드

해외몰인 경우 필수 입력  
한국 : KR / 중국: CN / 일본: JP / 필리핀: PH / 미국: US / 대만: TW / 베트남 : VN

 |
| clearance\_information\_type | 

통관정보 유형

I : 신분증 ID  
P : 여권번호  
C : 개인통관고유부호

 |
| clearance\_information | 

통관정보

 |
| shipping\_code | 

배송번호

 |
| change\_default\_shipping\_address | 

기본배송지 변경 여부

T : 변경함  
F : 변경안함

DEFAULT F

 |
| virtual\_phone\_no | 

수령자 안심번호

**Youtube shopping 이용 시에는 미제공**

복수 배송지 주문일 경우 수령자 안심번호 수정 불가

 |
| wished\_delivery\_date  

_날짜_

 | 

희망배송일

**Youtube shopping 이용 시에는 미제공**

 |
| use\_fast\_delivery\_date | 

가능한 빠른 배송일 설정 여부

**Youtube shopping 이용 시에는 미제공**

가능한 빠른 배송시간 설정 여부'가 'T' 일때는 null 로 응답함

T: 사용함  
F: 사용안함

 |
| wished\_delivery\_time | 

희망배송시간

**Youtube shopping 이용 시에는 미제공**

희망배송 시작시간(start\_hour)  
00~23 까지 입력 가능  
  
희망배송 종료시간(end\_hour)  
00~23 까지 입력 가능

 |
| 

wished\_delivery\_time 하위 요소 보기

**start\_hour**  
희망배송 시작시간

**end\_hour**  
희망배송 종료시간







 |
| use\_fast\_delivery\_time | 

가능한 빠른 배송시간 설정 여부

가능한 빠른 배송일 설정 여부'가 'T' 일때는 null 로 응답함

T: 사용함  
F: 사용안함

 |

Update order recipients

*   [Update order recipients](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Change shipping information [](#change-shipping-information)cafe24 youtube

PUT /api/v2/admin/orders/{order\_id}/receivers/{shipping\_code}

###### PUT

특정 주문의 특정 배송번호에 대한 수령자정보를 수정할 수 있습니다.  
배송번호와 관계없이 수령자정보를 수정하기 위해서는 Update orders receivers 를 이용해주세요.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |
| **shipping\_code**  
**Required** | 

배송번호

 |
| name  

_최대글자수 : \[20자\]_

 | 

수령자명

 |
| phone  

_최대글자수 : \[20자\]_

 | 

수령자 일반 전화

 |
| cellphone  

_최대글자수 : \[20자\]_

 | 

수령자 휴대 전화

 |
| shipping\_message | 

배송 메세지

 |
| name\_furigana | 

수령자명 (발음)

 |
| zipcode  

_최소글자수 : \[2자\]_  
_최대글자수 : \[14자\]_

 | 

우편번호

 |
| address1  

_최대글자수 : \[255자\]_

 | 

기본 주소

 |
| address2  

_최대글자수 : \[255자\]_

 | 

상세 주소

 |
| address\_state | 

주/도

 |
| address\_city | 

시/군/도시

 |
| name\_en | 

수령자명 (영문)

 |
| city\_en | 

수령자 도시 (영문)

 |
| state\_en | 

수령자 주 (영문)

 |
| street\_en | 

수령자 주소 (영문)

 |
| country\_code | 

국가코드

 |
| clearance\_information\_type | 

통관정보 유형

I : 신분증 ID  
P : 여권번호  
C : 개인통관고유부호

 |
| clearance\_information | 

통관정보

 |
| change\_default\_shipping\_address | 

기본배송지 변경 여부

T : 변경함  
F : 변경안함

DEFAULT F

 |
| virtual\_phone\_no | 

수령자 안심번호

복수 배송지 주문일 경우 수령자 안심번호 수정 불가

 |
| wished\_delivery\_date  

_날짜_

 | 

희망배송일

 |
| use\_fast\_delivery\_date | 

가능한 빠른 배송일 설정 여부

가능한 빠른 배송시간 설정 여부'가 'T' 일때는 null 로 응답함

T: 사용함  
F: 사용안함

 |
| wished\_delivery\_time | 

희망배송시간

희망배송 시작시간(start\_hour)  
00~23 까지 입력 가능  
  
희망배송 종료시간(end\_hour)  
00~23 까지 입력 가능

 |
| 

wished\_delivery\_time 하위 요소 보기

**start\_hour**  
희망배송 시작시간

**end\_hour**  
희망배송 종료시간







 |
| use\_fast\_delivery\_time | 

가능한 빠른 배송시간 설정 여부

가능한 빠른 배송일 설정 여부'가 'T' 일때는 null 로 응답함

T: 사용함  
F: 사용안함

 |
| receiver\_direct\_input\_check | 

주소 직접입력

 |

Change shipping information

*   [Change shipping information](#none)
*   [Update the receive's address](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders receivers history

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Orders%20receivers%20history.png)  
  
주문수령자 이력(Orders receivers history)은 특정 주문의 수령자 정보 변경이력에 대한 기능입니다.  
수정일(updated\_date) 파라메터를 통해 언제 정보가 변경되었는지 확인할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orders/{order_id}/receivers/history
```

#### \[더보기 상세 내용\]

### Orders receivers history property list[](#orders__receivers-history-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| name | 

수령자명

 |
| phone | 

전화번호

 |
| cellphone | 

수령자 휴대 전화

 |
| zipcode | 

우편번호

 |
| address1 | 

기본 주소

 |
| address2 | 

상세 주소

 |
| address\_state | 

주/도

 |
| address\_city | 

시/군/도시

 |
| address\_street | 

도로명

 |
| address\_full | 

전체주소

 |
| name\_en | 

수령자명 (영문)

 |
| city\_en | 

수령자 도시 (영문)

 |
| state\_en | 

수령자 주 (영문)

 |
| street\_en | 

수령자 주소 (영문)

 |
| country\_code | 

국가코드

 |
| country\_name | 

국가명

 |
| country\_name\_en | 

국가명 (영문)

 |
| shipping\_message | 

배송 메세지

 |
| updated\_date | 

수정일

 |
| user\_id | 

주문자 수정자 ID

 |
| user\_name | 

주문자 수정자 명

 |
| shipping\_code | 

배송번호

 |

### Retrieve a list of recipient history of an order [](#retrieve-a-list-of-recipient-history-of-an-order)cafe24 youtube

GET /api/v2/admin/orders/{order\_id}/receivers/history

###### GET

주문수령자가 변경된 이력과 그 내용을 조회할 수 있습니다.  
수령자명, 전화번호, 주소 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |

Retrieve a list of recipient history of an order

*   [Retrieve a list of recipient history of an order](#none)
*   [Retrieve history with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders refunds

주문 환불(Orders refunds)은 특정 주문의 환불상태와 관련된 기능입니다.  
특정 주문의 환불상태를 수정할 수 있습니다.

> Endpoints

```
PUT /api/v2/admin/orders/{order_id}/refunds/{refund_code}
```

#### \[더보기 상세 내용\]

### Orders refunds property list[](#orders__refunds-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| refund\_code | 

환불번호

 |
| status | 

환불상태

 |
| reason | 

처리사유

 |

### Update an order refund [](#update-an-order-refund)cafe24 youtube

PUT /api/v2/admin/orders/{order\_id}/refunds/{refund\_code}

###### PUT

특정 주문의 환불상태를 수정할 수 있습니다.  
처리사유를 입력할 수 있고 환불처리 후 SMS 나 메일도 발송되게끔 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **refund\_code**  
**Required** | 

환불번호

 |
| **status**  
**Required** | 

환불상태

complete : 환불완료

 |
| reason  

_최대글자수 : \[2000자\]_

 | 

처리사유

 |
| send\_sms | 

환불처리후 SMS 발송 여부

T : 발송함  
F : 발송안함

DEFAULT T

 |
| send\_mail | 

환불처리후 메일 발송 여부

T : 발송함  
F : 발송안함

DEFAULT T

 |
| payment\_gateway\_cancel | 

PG 취소 요청 여부

T : 취소함  
F : 취소안함

DEFAULT F

 |

Update an order refund

*   [Update an order refund](#none)
*   [Try refund order that has been already refunded](#none)
*   [Try refund order with wrong refund\_code](#none)
*   [Try refund when order does not supports PG cancel](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders return

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20return.png)  
  
주문 반품(Orders return)은 특정 주문의 반품과 관련된 기능입니다.  
특정 주문을 반품처리 하거나, 반품처리중인 주문의 상태를 수정할 수 있습니다.

> Endpoints

```
POST /api/v2/admin/orders/{order_id}/return
PUT /api/v2/admin/orders/{order_id}/return/{claim_code}
```

#### \[더보기 상세 내용\]

### Orders return property list[](#orders__return-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| status | 

주문상태

accepted : 반품접수  
processing : 반품처리중  
returned : 반품완료

 |
| claim\_code | 

반품번호

 |
| items | 

품주코드

 |
| pickup\_completed | 

수거완료 여부

T : 수거완료  
F : 수거전

 |
| carrier\_id | 

배송사 아이디

 |
| return\_invoice\_no  

_최대글자수 : \[40자\]_

 | 

반품 송장 번호

 |
| return\_shipping\_company\_name  

_최대글자수 : \[30자\]_

 | 

반품 배송업체명

 |
| return\_invoice\_success | 

반송장 처리 성공 여부

T : 성공  
F : 실패  
N : 미집하

 |
| return\_invoice\_fail\_reason  

_최대글자수 : \[100자\]_

 | 

반송장 처리 실패 사유

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

 |
| request\_pickup | 

수거신청 여부

T : 사용함  
F : 사용안함

 |
| pickup | 

수거지역 상세

 |
| undone | 

철회 여부

T : 철회함  
F : 철회안함

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

 |
| undone\_reason\_type | 

철회 사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| undone\_reason | 

철회 사유

 |
| expose\_order\_detail | 

주문상세내역 노출 여부

T : 노출함  
F : 노출안함

 |
| exposed\_undone\_reason | 

주문상세내역 노출 철회 사유

 |

### Create an order return [](#create-an-order-return)cafe24

POST /api/v2/admin/orders/{order\_id}/return

###### POST

특정 배송 후 주문 하나를 반품 처리할 수 있는 기능입니다.  
해당 API를 사용하여 반품완료처리할 경우 환불완료 처리와 함께 PG 취소도 같이 진행할 수 있습니다.(payment\_gateway\_cancel : "T"로 요청시)  
부분반품할 경우 각 환불 금액은 자동 계산되어 환불처리됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| payment\_gateway\_cancel | 

PG 취소 요청 여부

주문을 반품처리함과 동시에 PG취소도 같이 처리할 수 있다.  
  
PG취소가 가능한 결제수단(신용카드, 실시간계좌이체)에서만 사용 가능하다.  
  
결제수단이 복수인 주문(카드 등으로 결제한 주문을 결제 후 품목을 추가한 경우)의 경우에는 PG 결제를 취소할 수 없으며 관리자 화면에서 취소해야 한다.  
  
오픈마켓/네이버페이 주문을 취소할 경우 사용 불가

T : 취소함  
F : 취소안함

DEFAULT F

 |
| **status**  
**Required** | 

주문상태

accepted : 반품접수  
processing : 반품처리중  
returned : 반품완료

 |
| pickup\_completed | 

수거완료 여부

T : 수거완료  
F : 수거전

DEFAULT F

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

DEFAULT F

 |
| recover\_coupon | 

쿠폰 복원

**Youtube shopping 이용 시에는 미제공**

T : 복구함  
F : 복구안함

DEFAULT F

 |
| recover\_coupon\_no | 

복원할 쿠폰 번호

**Youtube shopping 이용 시에는 미제공**

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

DEFAULT F

 |
| reason  

_최대글자수 : \[2000자\]_

 | 

반품사유

 |
| claim\_reason\_type | 

반품사유 구분

A : 고객변심  
B : 배송지연  
C : 배송불가지역  
L : 수출/통관 불가  
D : 포장불량  
E : 상품불만족  
F : 상품정보상이  
G : 서비스불만족  
H : 품절  
I : 기타

 |
| naverpay\_return\_reason\_type | 

네이버페이 반품사유 구분

**Youtube shopping 이용 시에는 미제공**

카카오페이 주문을 반품할 경우 사용 불가

**EC 베트남, 필리핀, 일본 버전에서는 사용할 수 없음.**

51 : 구매 의사 취소  
52 : 색상 및 사이즈 변경  
53 : 다른 상품 잘못 주문  
54 : 서비스 및 상품 불만족  
55 : 배송 지연  
56 : 상품 품절  
57 : 배송 누락  
58 : 미배송  
59 : 상품 파손  
60 : 상품 정보 상이  
61 : 오배송  
62 : 색상 등 옵션이 다른 상품 잘못 배송

 |
| refund\_method\_code | 

환불 방식

T : 현금  
F : 신용카드  
M : 적립금  
G : 계좌이체  
C : 휴대폰  
D : 예치금  
Z : 후불  
O : 선불금  
V : 편의점  
J : 제휴상품권  
K : 제휴포인트  
I : 기타

 |
| refund\_bank\_code | 

환불 은행 코드

환불 방식(refund\_method)이 현금(T)일 경우 필수  
  
[refund\_bank\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/refund_bank_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)  
  
※ 해당 쇼핑몰이 EC Korea 쇼핑몰일 경우 필수

 |
| refund\_bank\_name  

_최대글자수 : \[250자\]_

 | 

환불은행명

환불 방식(refund\_method)이 현금(T)일 경우 필수  
  
※ 해당 쇼핑몰이 EC Global 쇼핑몰일 경우 필수  
환불수단(refund\_method)이 "현금(T)"일 때만 사용 가능

 |
| refund\_bank\_account\_no | 

환불 계좌번호

환불 방식(refund\_method)이 현금(T)일 경우 필수

 |
| refund\_bank\_account\_holder  

_최대글자수 : \[15자\]_

 | 

환불계좌 예금주 명의

 |
| items | 

품주코드

 |
| 

items 하위 요소 보기

**order\_item\_code**  
**Required**  
품주코드

**quantity**  
**Required**  
수량







 |
| request\_pickup | 

수거신청 여부

T : 사용함  
F : 사용안함

 |
| pickup | 

수거지역 상세

 |
| 

pickup 하위 요소 보기

**name**  
이름

**phone**  
전화번호

**cellphone**  
휴대전화

**zipcode**  
우편번호

**address1**  
기본 주소

**address2**  
상세 주소







 |
| return\_invoice\_no  

_최대글자수 : \[40자\]_

 | 

반품 송장 번호

 |
| return\_shipping\_company\_name  

_최대글자수 : \[30자\]_

 | 

반품 배송업체명

 |

Create an order return

*   [Create an order return](#none)
*   [Return the order](#none)
*   [Return the order with cancellation request to payment gateway](#none)
*   [Return specific item of the order](#none)
*   [Return the order with cancellation request to payment gateway](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update an order return [](#update-an-order-return)cafe24

PUT /api/v2/admin/orders/{order\_id}/return/{claim\_code}

###### PUT

주문의 특정 반품번호의 반품접수상태를 수정하는 기능입니다.  
반품이 접수된 주문을 수정할 수 있습니다.  
Update an orders return 을 통해 반품접수를 철회하거나, 재고를 복구하거나, 철회사유를 입력할 수 있습니다.  
택배사에 이미 수거요청이 전달되었으나 수거가 필요하지 않게 될 경우, 택배사에 직접 연락하셔서 수거요청을 취소해주셔야 합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **claim\_code**  
**Required** | 

반품번호

 |
| status | 

주문상태

processing : 반품처리중  
returned : 반품완료

 |
| carrier\_id | 

배송사 아이디

배송사에서 반송장번호 업데이트시 carrier\_id 필수

 |
| return\_invoice\_no  

_최대글자수 : \[40자\]_

 | 

반품 송장 번호

 |
| return\_shipping\_company\_name  

_최대글자수 : \[30자\]_

 | 

반품 배송업체명

 |
| return\_invoice\_success | 

반송장 처리 성공 여부

T : 성공  
F : 실패  
N : 미집하

 |
| return\_invoice\_fail\_reason  

_최대글자수 : \[100자\]_

 | 

반송장 처리 실패 사유

 |
| refund\_method\_code | 

환불 방식

T : 현금  
F : 신용카드  
M : 적립금  
G : 계좌이체  
C : 휴대폰  
D : 예치금  
Z : 후불  
O : 선불금  
V : 편의점  
J : 제휴상품권  
K : 제휴포인트  
I : 기타

 |
| refund\_bank\_account\_holder  

_최대글자수 : \[15자\]_

 | 

환불계좌 예금주 명의

 |
| pickup\_completed | 

수거완료 여부

T : 수거완료  
F : 수거전

 |
| items | 

품주코드

 |
| 

items 하위 요소 보기

**order\_item\_code**  
품주코드







 |
| recover\_coupon | 

쿠폰 복원

**Youtube shopping 이용 시에는 미제공**

T : 복구함  
F : 복구안함

 |
| recover\_coupon\_no | 

복원할 쿠폰 번호

**Youtube shopping 이용 시에는 미제공**

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

 |
| request\_pickup | 

수거신청 여부

반송지 저장시 기본값은 "수거신청함(T)"

T : 사용함  
F : 사용안함

 |
| pickup | 

수거지역 상세

 |
| 

pickup 하위 요소 보기

**name**  
이름

**phone**  
전화번호

**cellphone**  
휴대전화

**zipcode**  
우편번호

**address1**  
기본 주소

**address2**  
상세 주소







 |
| undone | 

철회 여부

T : 철회함

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

 |
| undone\_reason\_type | 

철회 사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| undone\_reason  

_최대글자수 : \[2000자\]_

 | 

철회 사유

 |
| expose\_order\_detail | 

주문상세내역 노출 여부

T : 노출함  
F : 노출안함

 |
| exposed\_undone\_reason  

_최대글자수 : \[2000자\]_

 | 

주문상세내역 노출 철회 사유

 |
| refund\_bank\_code | 

환불 은행 코드

 |
| refund\_bank\_name  

_최대글자수 : \[250자\]_

 | 

환불은행명

 |
| refund\_bank\_account\_no | 

환불 계좌번호

 |

Update an order return

*   [Update an order return](#none)
*   [Update pickup status for return](#none)
*   [Withdraw the return](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders shipments

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20shipments.png)  
  
주문의 배송(Shipments)은 주문을 배송처리하기 위해 필요한 배송 정보를 의미합니다.  
주문의 배송 정보에는 송장번호와 배송사 정보, 배송 상태 등이 있습니다.  
주문의 배송 기능을 활용하여 주문을 배송대기 처리하거나 배송중 처리할 수 있으며 송장번호 등도 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orders/{order_id}/shipments
POST /api/v2/admin/orders/{order_id}/shipments
PUT /api/v2/admin/orders/{order_id}/shipments/{shipping_code}
DELETE /api/v2/admin/orders/{order_id}/shipments/{shipping_code}
```

#### \[더보기 상세 내용\]

### Orders shipments property list[](#orders__shipments-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| shipping\_code | 

배송번호

 |
| order\_id | 

주문번호

 |
| tracking\_no | 

송장번호

 |
| tracking\_no\_updated\_date | 

송장번호입력일

 |
| shipping\_company\_code | 

배송업체 코드

[shipping\_company\_code](https://s3.ap-northeast-2.amazonaws.com/appservice-guide/resource/ko/shipping_company_code_kr.csv) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| items | 

품주 목록

 |
| status | 

주문상태

standby : 배송대기  
shipping : 배송중  
shipped : 배송완료

 |
| order\_item\_code | 

품주코드

 |
| carrier\_id | 

배송사 아이디

 |
| status\_additional\_info | 

주문상태 추가정보

 |

### Retrieve a list of shipping information of an order [](#retrieve-a-list-of-shipping-information-of-an-order)cafe24 youtube

GET /api/v2/admin/orders/{order\_id}/shipments

###### GET

주문에 등록된 배송번호를 목록으로 조회할 수 있습니다.  
배송번호, 주문번호, 송장번호 등을 조회할 수 있습니다.  
부분배송으로 진행한 경우 주문1건에 배송번호는 여러개일 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

 |

Retrieve a list of shipping information of an order

*   [Retrieve a list of shipping information of an order](#none)
*   [Retrieve shipments with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create an order shipping information [](#create-an-order-shipping-information)cafe24 youtube

POST /api/v2/admin/orders/{order\_id}/shipments

###### POST

주문에 송장번호 등의 배송정보를 등록하여 주문을 배송대기 시키거나 배송중 처리할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **tracking\_no**  
**Required**  

_최대글자수 : \[40자\]_

 | 

송장번호

 |
| **shipping\_company\_code**  
**Required** | 

배송업체 코드

[shipping\_company\_code](https://s3.ap-northeast-2.amazonaws.com/appservice-guide/resource/ko/shipping_company_code_kr.csv) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| order\_item\_code | 

품주코드

 |
| **status**  
**Required** | 

주문상태

standby : 배송대기  
shipping : 배송중

 |
| shipping\_code | 

배송번호

 |
| carrier\_id | 

배송사 아이디

 |

Create an order shipping information

*   [Create an order shipping information](#none)
*   [Register shipment information using only tracking\_no, shipping\_company\_code, and status fields](#none)
*   [Try registering shipment information without tracking\_no field](#none)
*   [Try registering shipment information without shipping\_company\_code field](#none)
*   [Try registering shipment information without status field](#none)
*   [Standby a shipment with tracking number](#none)
*   [Process a shipment with tracking number](#none)
*   [Process specific item of the order](#none)
*   [Process a shipments with shipping code](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update an order shipping [](#update-an-order-shipping)cafe24 youtube

PUT /api/v2/admin/orders/{order\_id}/shipments/{shipping\_code}

###### PUT

주문에 등록된 배송번호의 배송 정보를 수정할 수 있습니다.  
주문상태, 배송업체 코드 등을 변경할 수 있습니다.  
부분배송으로 진행한 경우 주문1건에 배송번호는 여러개일 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **shipping\_code**  
**Required** | 

배송번호

 |
| status | 

주문상태

status 사용하여 배송상태 수정시 tracking\_no, shipping\_company\_code는 사용 불가

standby : 배송대기  
shipping : 배송중  
shipped : 배송완료

 |
| status\_additional\_info  

_최대글자수 : \[30자\]_

 | 

주문상태 추가정보

 |
| tracking\_no  

_최대글자수 : \[40자\]_

 | 

송장번호

tracking\_no 사용시 shipping\_company\_code를 함께 사용해야 하며, 송장번호 수정시 status는 사용 불가

 |
| shipping\_company\_code | 

배송업체 코드

[shipping\_company\_code](https://s3.ap-northeast-2.amazonaws.com/appservice-guide/resource/ko/shipping_company_code_kr.csv) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)  
  
tracking\_no 사용시 shipping\_company\_code를 함께 사용해야 하며, 송장번호 수정시 status는 사용 불가

 |

Update an order shipping

*   [Update an order shipping](#none)
*   [Update shipment status of the order to standby](#none)
*   [Change tracking number and shipping company of the order](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete an order shipping [](#delete-an-order-shipping)cafe24 youtube

DELETE /api/v2/admin/orders/{order\_id}/shipments/{shipping\_code}

###### DELETE

주문에 등록된 배송번호를 삭제할 수 있습니다.  
부분배송으로 진행한 경우 주문1건에 배송번호는 여러개일 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **shipping\_code**  
**Required** | 

배송번호

 |

Delete an order shipping

*   [Delete an order shipping](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders shippingfeecancellation

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20shippingfeecancellation.png)  
  
주문의 배송비취소(Orders shippingfeecancellation)를 통해 주문의 취소현황을 조회하거나 취소처리를 요청할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orders/{order_id}/shippingfeecancellation
POST /api/v2/admin/orders/{order_id}/shippingfeecancellation
```

#### \[더보기 상세 내용\]

### Orders shippingfeecancellation property list[](#orders__shippingfeecancellation-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| default\_shipping\_fee | 

기본 배송비

 |
| supplier\_shipping\_fee | 

공급사배송비

 |
| individual\_shipping\_fee | 

개별배송비

 |
| international\_shipping\_fee | 

해외배송비

 |
| international\_shipping\_insurance\_fee | 

해외배송 보험료

 |
| additional\_shipping\_fee | 

추가 배송비

 |
| additional\_handling\_fee | 

해외배송 부가금액

 |
| regional\_surcharge\_amount | 

지역별 배송비

 |
| claim\_code | 

취소 번호

 |
| claim\_reason\_type | 

구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| claim\_reason | 

사유

 |
| refund\_method | 

환불 방식

 |
| shipping\_discount\_amount | 

배송비할인 취소액

 |
| coupon\_discount\_amount | 

쿠폰할인 취소액

 |
| refund\_amount | 

환불금액

 |
| point\_used | 

사용된 적립금 반환액

 |
| credit\_used | 

사용된 예치금 반환액

 |
| mixed\_refund\_amount | 

복합 환불 금액

 |
| mixed\_refund\_methods | 

복합 환불 방식

 |
| status | 

주문상태

canceled: 취소완료  
canceling : 취소처리중

 |
| include\_tax | 

가격에 세금 포함

T: 세금포함  
F: 세금제외

 |
| tax | 

세금 정보

세금 관리자 앱을 사용 안 할 경우 null로 반환

 |

### Retrieve shipping fee cancellation details of an order [](#retrieve-shipping-fee-cancellation-details-of-an-order)cafe24 youtube

GET /api/v2/admin/orders/{order\_id}/shippingfeecancellation

###### GET

주문의 취소처리 현황을 목록으로 조회할 수 있습니다.  
기본 배송비, 공급사 배송비, 지역별 배송비 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |

Retrieve shipping fee cancellation details of an order

*   [Retrieve shipping fee cancellation details of an order](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create an order shipping fee cancellation [](#create-an-order-shipping-fee-cancellation)cafe24 youtube

POST /api/v2/admin/orders/{order\_id}/shippingfeecancellation

###### POST

주문의 취소처리를 요청할 수 있습니다.  
본 API는 취소를 요청하는 것이고 취소를 처리하는 것은 아닌 점 참고 부탁 드립니다.  
PG 취소까지 자동으로 되는 것은 아니며 payment\_gateway\_cancel 파라메터를 T 로 하여 함께 요청해야만 PG도 동시에 취소요청 됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| reason  

_최대글자수 : \[2000자\]_

 | 

취소사유

 |
| claim\_reason\_type | 

취소사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| recover\_coupon | 

쿠폰 복원

**Youtube shopping 이용 시에는 미제공**

T : 복구함  
F : 복구안함

DEFAULT F

 |
| refund\_method\_code | 

환불 방식

T : 현금  
F : 신용카드  
M : 적립금  
G : 계좌이체  
C : 휴대폰  
D : 예치금  
Z : 후불  
O : 선불금  
V : 편의점  
J : 제휴상품권  
K : 제휴포인트  
I : 기타

 |
| refund\_bank\_code | 

환불 은행 코드

 |
| refund\_bank\_name  

_최대글자수 : \[250자\]_

 | 

환불은행명

 |
| refund\_bank\_account\_no | 

환불 계좌번호

 |
| refund\_bank\_account\_holder  

_최대글자수 : \[30자\]_

 | 

환불계좌 예금주 명의

 |
| payment\_gateway\_cancel | 

PG 취소 요청 여부

T : 취소함  
F : 취소안함

DEFAULT F

 |

Create an order shipping fee cancellation

*   [Create an order shipping fee cancellation](#none)
*   [Cancel the shipping fee by using only required fields](#none)
*   [Try cancel the shipping fee when shipping fee is already free](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders shortagecancellation

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20shortagecancellation.png)  
  
주문의 재고부족취소(Orders shortagecancellation)는 이벤트 혹은 재고설정의 착오 등으로 인해 보유한 재고보다 많은 수량이 판매되었을 때  
취소완료 및 환불까지 처리할 수 있는 기능입니다.

> Endpoints

```
POST /api/v2/admin/orders/{order_id}/shortagecancellation
```

#### \[더보기 상세 내용\]

### Orders shortagecancellation property list[](#orders__shortagecancellation-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| status | 

주문상태

canceled : 취소완료  
canceling : 취소처리중

 |
| claim\_code | 

취소 번호

 |
| items | 

품주코드

 |

### Create an order cancellation on stock shortage [](#create-an-order-cancellation-on-stock-shortage)cafe24

POST /api/v2/admin/orders/{order\_id}/shortagecancellation

###### POST

특정 주문을 취소처리 및 환불까지 처리할 수 있습니다.  
재고나 쿠폰의 복원 여부도 선택할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| **order\_id**  
**Required** | 

주문번호

 |
| payment\_gateway\_cancel | 

PG 취소 요청 여부

T : 취소함  
F : 취소안함

DEFAULT F

 |
| keep\_auto\_calculation | 

할인금액 자동계산 플래그 보존여부

보존함 : T  
제거함 : F

DEFAULT F

 |
| collect\_gift | 

사은품 자동 회수

T : 사용함  
F : 사용안함

DEFAULT F

 |
| **status**  
**Required** | 

주문상태

accepted: 취소접수  
canceling : 취소처리중  
canceled : 취소완료

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

DEFAULT F

 |
| recover\_coupon | 

쿠폰 복원

T : 복구함  
F : 복구안함

DEFAULT F

 |
| recover\_coupon\_no | 

복원할 쿠폰 번호

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

DEFAULT F

 |
| reason  

_최대글자수 : \[2000자\]_

 | 

취소사유

 |
| claim\_reason\_type | 

취소사유 구분

A : 고객변심  
B : 배송지연  
C : 배송불가지역  
L : 수출/통관 불가  
D : 포장불량  
E : 상품불만족  
F : 상품정보상이  
G : 서비스불만족  
H : 품절  
I : 기타

 |
| naverpay\_cancel\_reason\_type | 

네이버페이 취소사유 구분

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

51 : 구매 의사 취소  
52 : 색상 및 사이즈 변경  
53 : 다른 상품 잘못 주문  
54 : 서비스 및 상품 불만족  
55 : 배송 지연  
56 : 상품 품절  
60 : 상품 정보 상이

 |
| kakaopay\_cancel\_reason\_type | 

카카오페이 취소사유 구분

K1 : 변심에 의한 상품 취소  
K2 : 다른 옵션이나 상품을 잘못 주문함  
K3 : 배송지연  
K4 : 상품 파손 또는 불량  
K5 : 다른 상품 오배송 또는 구성품 누락  
K6 : 상품정보와 다름  
K7 : 품절로 인한 배송 불가

 |
| refund\_method\_code | 

환불 방식

T : 현금  
F : 신용카드  
M : 적립금  
G : 계좌이체  
C : 휴대폰  
D : 예치금  
Z : 후불  
O : 선불금  
V : 편의점  
J : 제휴상품권  
K : 제휴포인트  
I : 기타

 |
| refund\_bank\_code | 

환불 은행 코드

 |
| refund\_bank\_name  

_최대글자수 : \[250자\]_

 | 

환불은행명

 |
| refund\_bank\_account\_no | 

환불 계좌번호

 |
| refund\_bank\_account\_holder  

_최대글자수 : \[15자\]_

 | 

환불계좌 예금주 명의

 |
| items | 

품주코드

 |
| 

items 하위 요소 보기

**order\_item\_code**  
**Required**  
품주코드

**quantity**  
**Required**  
수량







 |

Create an order cancellation on stock shortage

*   [Create an order cancellation on stock shortage](#none)
*   [Cancel the order by using only required fields](#none)
*   [Try cancel the order when order status is 'In transit'](#none)
*   [Try cancel the order by without refund\_method\_code field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders benefits

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20benefits.png)  
  
주문혜택(Orders benefits)은 특정 주문에 적용된 혜택에 관한 기능입니다.

> Endpoints

```
GET /api/v2/admin/orders/benefits
```

#### \[더보기 상세 내용\]

### Orders benefits property list[](#orders-benefits-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| order\_item\_code | 

품주코드

 |
| benefit\_no | 

혜택번호

 |
| benefit\_title | 

혜택 유형

 |
| benefit\_name | 

혜택명

 |
| benefit\_code | 

혜택코드

 |
| benefit\_percent | 

혜택 비율

 |
| benefit\_value | 

혜택 금액

 |
| benefit\_app\_key | 

앱 클라이언트 ID

 |

### Retrieve a list of order benefits applied to an order [](#retrieve-a-list-of-order-benefits-applied-to-an-order)cafe24 youtube

GET /api/v2/admin/orders/benefits

###### GET

특정 주문에 적용된 혜택을 목록으로 조회할 수 있습니다.  
혜택코드, 혜택비율, 혜택금액 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| limit  

_최소: \[1\]~최대: \[500\]_

 | 

조회결과 최대건수

DEFAULT 10

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a list of order benefits applied to an order

*   [Retrieve a list of order benefits applied to an order](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders calculation

주문의 결제예정금액 계산(Orders calculation)은 주문의 배송국가 등을 체크하여 결제예정금액을 계산하는 기능입니다.

> Endpoints

```
POST /api/v2/admin/orders/calculation
```

#### \[더보기 상세 내용\]

### Orders calculation property list[](#orders-calculation-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| mobile | 

모바일 PC 여부

 |
| member\_id | 

회원아이디

 |
| shipping\_type | 

배송 유형

A : 국내  
B : 해외

 |
| payment\_method | 

결제수단 코드

cash : 무통장  
card : 신용카드  
icash : 가상계좌  
tcash : 계좌이체  
cell : 휴대폰  
deferpay : 후불결제  
point : 적립금

 |
| country\_code | 

국가코드

 |
| carrier\_id | 

배송사 아이디

 |
| zipcode | 

우편번호

 |
| address\_full | 

전체주소

 |
| address\_state | 

주/도

 |
| items | 

주문상품목록

 |
| points\_spent\_amount | 

적립금사용금액

 |
| coupon\_discount\_amount | 

쿠폰 할인금액

 |
| membership\_discount\_amount | 

회원등급 할인금액

 |
| shipping\_fee\_discount\_amount | 

배송비 할인금액

 |
| product\_discount\_amount | 

상품별 할인금액

 |
| order\_price\_amount | 

상품 구매금액

 |
| total\_discount\_amount | 

총 할인금액

 |
| shipping\_fee | 

배송비

 |
| total\_amount\_due | 

결제예정 금액

 |
| shipping\_fee\_information | 

배송비 상세정보

 |
| tax\_free\_amount | 

면세 + 영세

 |
| vat\_amount | 

부가세

 |
| tax\_amount | 

과세

 |
| order\_coupons | 

주문서 쿠폰

 |

### Calculate total due [](#calculate-total-due)cafe24

POST /api/v2/admin/orders/calculation

###### POST

주문의 결제예정금액 계산 처리를 할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| mobile | 

모바일 PC 여부

T : 사용함  
F : 사용안함

DEFAULT F

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| shipping\_type | 

배송 유형

A : 국내  
B : 해외

DEFAULT A

 |
| payment\_method | 

결제수단 코드

cash : 무통장  
card : 신용카드  
icash : 가상계좌  
tcash : 계좌이체  
cell : 휴대폰  
deferpay : 후불결제  
point : 적립금

 |
| country\_code | 

국가코드

 |
| carrier\_id | 

배송사 아이디

 |
| zipcode | 

우편번호

 |
| address\_full  

_최대글자수 : \[1000자\]_

 | 

전체주소

 |
| address\_state  

_최대글자수 : \[255자\]_

 | 

주/도

 |
| items | 

주문상품목록

 |
| 

items 하위 요소 보기

**product\_no**  
**Required**  
상품번호

**variant\_code**  
**Required**  
상품 품목 코드

**option\_id**  
상품옵션 아이디

**quantity**  
**Required**  
수량

**product\_price**  
**Required**  
상품 판매가

**option\_price**  
옵션 추가 가격

**product\_bundle**  
세트상품 여부  
T : 세트상품  
F : 세트상품 아님  
DEFAULT F

**product\_bundle\_no**  
세트상품번호

**prepaid\_shipping\_fee**  
배송비 선결제 설정  
P : 선불  
C : 착불  
DEFAULT P

**product\_coupons**  
상품 쿠폰







 |
| points\_spent\_amount | 

적립금사용금액

 |
| order\_coupons | 

주문서 쿠폰

 |

Calculate total due

*   [Calculate total due](#none)
*   [Calculate an order by using only required field](#none)
*   [Try calculating an order with wrong product number](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders coupons

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20coupons.png)  
  
주문 쿠폰(Orders coupons)은 주문에 적용된 쿠폰에 관한 기능입니다.  
특정 주문에 대해 적용된 쿠폰의 정보를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orders/coupons
```

#### \[더보기 상세 내용\]

### Orders coupons property list[](#orders-coupons-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| order\_item\_code | 

품주코드

 |
| coupon\_name | 

쿠폰명

 |
| coupon\_code | 

쿠폰번호

 |
| coupon\_percent | 

쿠폰 비율

 |
| coupon\_value | 

쿠폰 금액

 |
| coupon\_value\_final | 

최종 쿠폰 금액

 |

### Retrieve a list of coupons applied to an order [](#retrieve-a-list-of-coupons-applied-to-an-order)cafe24

GET /api/v2/admin/orders/coupons

###### GET

특정 주문에 대해 적용된 쿠폰의 정보를 목록으로 조회할 수 있습니다.  
쿠폰번호, 쿠폰비율, 쿠폰금액 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| limit  

_최소: \[1\]~최대: \[500\]_

 | 

조회결과 최대건수

DEFAULT 10

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a list of coupons applied to an order

*   [Retrieve a list of coupons applied to an order](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders dashboard

주문관련 요약 정보를 확인할 수 있습니다.  
이 정보는 최근 한달동안 누적된 데이터를 기반으로 합니다.

> Endpoints

```
GET /api/v2/admin/orders/dashboard
```

#### \[더보기 상세 내용\]

### Orders dashboard property list[](#orders-dashboard-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| cancellation\_request\_count | 

취소신청 건수

 |
| cancellation\_received\_count | 

취소접수 건수

 |
| cancellation\_processing\_count | 

취소처리중 건수

 |
| exchange\_request\_count | 

교환신청 건수

 |
| exchange\_received\_count | 

교환접수 건수

 |
| exchange\_processing\_count | 

교환처리중 건수

 |
| return\_request\_count | 

반품신청 건수

 |
| return\_received\_count | 

반품접수 건수

 |
| return\_processing\_count | 

반품처리중 건수

 |
| refund\_pending\_count | 

환불전 건수

 |
| total\_order\_amount | 

총 주문 금액

 |
| total\_paid\_amount | 

총 실 결제금액

 |
| total\_refund\_amount | 

총 환불금액

 |
| total\_order\_count | 

총 주문금액 건수

 |
| total\_paid\_count | 

총 실결제 금액 건수

 |
| total\_refund\_count | 

총 환불금액 건수

 |

### List all orders dashboard [](#list-all-orders-dashboard)cafe24

GET /api/v2/admin/orders/dashboard

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

List all orders dashboard

*   [List all orders dashboard](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders inflowgroups

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20inflowgroups.png)  
  
유입경로 그룹(Inflowgroups)은 주문이 유입된 경로의 그룹을 의미합니다.  
유입경로 그룹은 하위 리소스로 주문(Orders) 하위에서만 사용할 수 있습니다.  
유입경로 그룹에 대한 조회, 생성, 수정, 삭제가 가능합니다.

> Endpoints

```
GET /api/v2/admin/orders/inflowgroups
POST /api/v2/admin/orders/inflowgroups
PUT /api/v2/admin/orders/inflowgroups/{inflow_group_id}
DELETE /api/v2/admin/orders/inflowgroups/{inflow_group_id}
```

#### \[더보기 상세 내용\]

### Orders inflowgroups property list[](#orders-inflowgroups-property-list)

| **Attribute** | **Description** |
| --- | --- |
| inflow\_group\_id | 
유입경로 그룹 아이디

 |
| inflow\_group\_name | 

유입경로 그룹 이름

 |

### Retrieve a list of traffic source groups [](#retrieve-a-list-of-traffic-source-groups)cafe24

GET /api/v2/admin/orders/inflowgroups

###### GET

유입경로 그룹 목록을 조회할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

Retrieve a list of traffic source groups

*   [Retrieve a list of traffic source groups](#none)
*   [Retrieve inflowgroups with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a traffic source group [](#create-a-traffic-source-group)cafe24

POST /api/v2/admin/orders/inflowgroups

###### POST

유입경로 그룹을 생성할 수 있습니다.  
유입경로 이름과 유입경로 아이디는 필수값입니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **inflow\_group\_id**  
**Required**  
_최대글자수 : \[40자\]_  
_형식 : \[a-zA-Z0-9\]_

 | 

유입경로 그룹 아이디

 |
| **inflow\_group\_name**  
**Required**  

_최대글자수 : \[100자\]_

 | 

유입경로 그룹 이름

 |

Create a traffic source group

*   [Create a traffic source group](#none)
*   [Create an inflow group to a mall](#none)
*   [Try creating an inflow group by without inflow\_group\_id field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a traffic source group [](#update-a-traffic-source-group)cafe24

PUT /api/v2/admin/orders/inflowgroups/{inflow\_group\_id}

###### PUT

유입경로 그룹을 수정할 수 있습니다.  
유입경로 그룹 아이디, 그룹 멤버 이름 등을 필수로 입력합니다.  
유입경로 그룹을 등록하면 같은 유입경로에 대해 그룹화하여 쉽게 알아볼 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **inflow\_group\_id**  
**Required**  
_형식 : \[a-zA-Z0-9\]_  
_최대글자수 : \[40자\]_

 | 

유입경로 그룹 아이디

 |
| **inflow\_group\_name**  
**Required**  

_최대글자수 : \[100자\]_

 | 

유입경로 그룹 이름

 |

Update a traffic source group

*   [Update a traffic source group](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a traffic source group [](#delete-a-traffic-source-group)cafe24

DELETE /api/v2/admin/orders/inflowgroups/{inflow\_group\_id}

###### DELETE

유입경로 그룹을 삭제할 수 있습니다.  
삭제할 때에는 유입경로 그룹의 아이디 멤버 아이디를 모두 입력해주셔야 합니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **inflow\_group\_id**  
**Required**  
_최대글자수 : \[40자\]_  
_형식 : \[a-zA-Z0-9\]_

 | 

유입경로 그룹 아이디

 |

Delete a traffic source group

*   [Delete a traffic source group](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders inflowgroups inflows

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Orders%20inflowgroups%20inflows.png)  
  
유입경로 그룹(Inflowgroups)은 주문이 유입된 경로의 그룹을 의미합니다.  
유입경로 그룹은 하위 리소스로 주문(Orders) 하위에서만 사용할 수 있습니다.  
유입경로 그룹에 대한 조회, 생성, 수정, 삭제가 가능합니다.

> Endpoints

```
GET /api/v2/admin/orders/inflowgroups/{group_id}/inflows
POST /api/v2/admin/orders/inflowgroups/{group_id}/inflows
PUT /api/v2/admin/orders/inflowgroups/{group_id}/inflows/{inflow_id}
DELETE /api/v2/admin/orders/inflowgroups/{group_id}/inflows/{inflow_id}
```

#### \[더보기 상세 내용\]

### Orders inflowgroups inflows property list[](#orders-inflowgroups__inflows-property-list)

| **Attribute** | **Description** |
| --- | --- |
| inflow\_id | 
유입경로 그룹 멤버 아이디

 |
| inflow\_name | 

유입경로 그룹 멤버 이름

 |
| inflow\_icon | 

유입경로 아이콘

 |
| group\_id | 

유입경로 그룹 아이디

 |

### Retrieve a list of group traffic sources [](#retrieve-a-list-of-group-traffic-sources)cafe24

GET /api/v2/admin/orders/inflowgroups/{group\_id}/inflows

###### GET

특정 유입경로 그룹 내에 속한 유입경로의 목록을 조회할 수 있습니다.  
유입경로 그룹 멤버 이름, 유입경로 아이콘, 유입경로 그룹 아이디를 확인할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **group\_id**  
**Required**  
_최대글자수 : \[40자\]_

 | 

유입경로 그룹 아이디

 |

Retrieve a list of group traffic sources

*   [Retrieve a list of group traffic sources](#none)
*   [Retrieve inflows with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a group traffic source [](#create-a-group-traffic-source)cafe24

POST /api/v2/admin/orders/inflowgroups/{group\_id}/inflows

###### POST

특정 유입경로 그룹 내에 속한 유입경로를 생성할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **group\_id**  
**Required**  
_최대글자수 : \[40자\]_

 | 

유입경로 그룹 아이디

 |
| **inflow\_id**  
**Required**  

_최대글자수 : \[40자\]_

 | 

유입경로 그룹 멤버 아이디

 |
| **inflow\_name**  
**Required**  

_최대글자수 : \[100자\]_

 | 

유입경로 그룹 멤버 이름

 |
| **inflow\_icon**  
**Required**  

_URL_  
_최대글자수 : \[500자\]_

 | 

유입경로 아이콘

 |

Create a group traffic source

*   [Create a group traffic source](#none)
*   [Create an inflow to a certain inflow group by using only required fields](#none)
*   [Try creating an inflow to a certain inflow group by wihtout inflow\_id field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a group traffic source [](#update-a-group-traffic-source)cafe24

PUT /api/v2/admin/orders/inflowgroups/{group\_id}/inflows/{inflow\_id}

###### PUT

특정 유입경로 그룹 내에 속한 유입경로를 수정할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **group\_id**  
**Required**  
_최대글자수 : \[40자\]_

 | 

유입경로 그룹 아이디

 |
| **inflow\_id**  
**Required**  

_최대글자수 : \[40자\]_

 | 

유입경로 그룹 멤버 아이디

 |
| **inflow\_name**  
**Required**  

_최대글자수 : \[100자\]_

 | 

유입경로 그룹 멤버 이름

 |
| **inflow\_icon**  
**Required**  

_URL_  
_최대글자수 : \[500자\]_

 | 

유입경로 아이콘

 |

Update a group traffic source

*   [Update a group traffic source](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a group traffic source [](#delete-a-group-traffic-source)cafe24

DELETE /api/v2/admin/orders/inflowgroups/{group\_id}/inflows/{inflow\_id}

###### DELETE

특정 유입경로 그룹 내에 속한 유입경로를 삭제할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **group\_id**  
**Required**  
_최대글자수 : \[40자\]_

 | 

유입경로 그룹 아이디

 |
| **inflow\_id**  
**Required**  

_최대글자수 : \[40자\]_

 | 

유입경로 그룹 멤버 아이디

 |

Delete a group traffic source

*   [Delete a group traffic source](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders memos

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20memos.png)  
  
주문 메모(Orders memos)는 특정 주문의 메모에 대한 주문의 하위 리소스 입니다.  
주문에 대하여 관리자 메모의 조회, 등록, 수정, 삭제를 할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orders/memos
```

#### \[더보기 상세 내용\]

### Orders memos property list[](#orders-memos-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| memo\_no | 

메모 번호

 |
| order\_id | 

주문번호

 |
| created\_date | 

메모 등록일

 |
| author\_id | 

작성자 아이디

 |
| ip | 

작성자 아이피

 |
| use\_customer\_inquiry | 

고객상담 동시등록 여부

T : 사용함  
F : 사용안함

 |
| attach\_type | 

등록기준

O : 주문별  
P : 품목별

 |
| content | 

메모 내용

 |
| starred\_memo | 

중요 메모 여부

T : 중요 메모  
F : 일반 메모

 |
| fixed | 

상단고정 여부

T : 사용함  
F : 사용안함

 |
| product\_list | 

상품 목록

 |

### Retrieve a list of admin memos for an order [](#retrieve-a-list-of-admin-memos-for-an-order)cafe24 youtube

GET /api/v2/admin/orders/memos

###### GET

여러개의 주문에 대한 메모를 목록으로 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_주문번호_

 | 

주문번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| limit  

_최소: \[1\]~최대: \[500\]_

 | 

조회결과 최대건수

DEFAULT 10

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a list of admin memos for an order

*   [Retrieve a list of admin memos for an order](#none)
*   [Retrieve memos with fields parameter](#none)
*   [Retrieve multiple memos](#none)
*   [Retrieve memos using paging](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders migrations

이전된 몰의 주문에 대한 주문정보를 등록, 조회, 수정, 삭제할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orders/migrations
POST /api/v2/admin/orders/migrations
PUT /api/v2/admin/orders/migrations
DELETE /api/v2/admin/orders/migrations/{order_id}
```

#### \[더보기 상세 내용\]

### Orders migrations property list[](#orders-migrations-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| order\_date | 

주문일

 |
| member\_id | 

회원아이디

 |
| payment\_status | 

결제상태

 |
| order\_status | 

주문상태

 |
| payed\_amount | 

실결제금액

 |
| bank\_code\_name | 

입금자 은행명

 |
| bank\_account\_owner\_name | 

예금주

 |
| payment\_method | 

결제수단 코드

 |
| mileage\_used | 

적립금사용금액

 |
| deposit\_used | 

예치금사용금액

 |
| buyer | 

주문자정보 리소스

 |
| receivers | 

수령자정보 리소스

 |
| items | 

품주 리소스

 |

### Retrieve order from migrated store [](#retrieve-order-from-migrated-store)cafe24

GET /api/v2/admin/orders/migrations

###### GET

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| start\_date  

_날짜_

 | 

검색 시작일

 |
| end\_date  

_날짜_

 | 

검색 종료일

 |
| order\_id | 

주문번호

 |
| order\_status | 

주문상태

 |
| payment\_status | 

결제상태

 |
| buyer\_name | 

주문자 이름

 |
| member\_id | 

회원아이디

 |
| receiver\_name | 

수령자명

 |
| buyer\_cellphone | 

주문자 휴대 전화

 |
| buyer\_phone | 

주문자 일반 전화

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |
| order | 

정렬 순서

asc : 순차정렬  
desc : 역순 정렬

DEFAULT desc

 |
| sort | 

정렬 순서 값

order\_date : 주문일  
paid\_amount : 결제금액

DEFAULT order\_date

 |

Retrieve order from migrated store

*   [Retrieve order from migrated store](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create order from migrated store [](#create-order-from-migrated-store)cafe24

POST /api/v2/admin/orders/migrations

###### POST

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_최대글자수 : \[32자\]_

 | 

주문번호

 |
| order\_date  

_날짜_

 | 

주문일

 |
| member\_id  

_최대글자수 : \[32자\]_

 | 

회원아이디

 |
| mileage\_used  

_최소값: \[0\]_  
_최대값: \[99999999999999\]_

 | 

적립금사용��액

 |
| deposit\_used  

_최소값: \[0\]_  
_최대값: \[99999999999999\]_

 | 

예치금사용금액

 |
| payment\_status | 

결제상태

T : 결제  
F : 미결제

DEFAULT F

 |
| order\_status  

_최대글자수 : \[20자\]_

 | 

주문상태

 |
| payed\_amount  

_최소값: \[0\]_  
_최대값: \[99999999999999\]_

 | 

실결제금액

 |
| bank\_code\_name  

_최대글자수 : \[64자\]_

 | 

입금자 은행명

 |
| bank\_account\_owner\_name  

_최대글자수 : \[32자\]_

 | 

예금주

 |
| payment\_method  

_최대글자수 : \[10자\]_

 | 

결제수단 코드

 |
| buyer | 

주문자정보 리소스

 |
| 

buyer 하위 요소 보기

**name**  
주문자 이름

**zipcode**  
주문자 우편번호

**address**  
주문자 기본 주소

**email**  
주문자 이메일

**phone**  
주문자 일반 전화

**cellphone**  
주문자 휴대 전화

**message**  
배송 메세지







 |
| receivers | 

수령자정보 리소스

 |
| 

receivers 하위 요소 보기

**name**  
수령자명

**zipcode**  
수령자 우편번호

**address**  
수령자 기본 주소

**phone**  
수령자 일반 전화

**cellphone**  
수령자 휴대 전화







 |
| items | 

품주 리소스

 |
| 

items 하위 요소 보기

**product\_no**  
상품번호

**product\_name**  
상품명

**option**  
상품 옵션 리소스

**quantity**  
수량

**product\_price**  
상품 판매가

**payment\_status**  
결제상태  
T : 결제  
F : 미결제

**order\_status**  
주문상태

**payed\_amount**  
상품구매금액

**total\_payed\_amount**  
품목별 실결제금액







 |

Create order from migrated store

*   [Create order from migrated store](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update order from migrated store [](#update-order-from-migrated-store)cafe24

PUT /api/v2/admin/orders/migrations

###### PUT

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_최대글자수 : \[32자\]_

 | 

주문번호

 |
| order\_date  

_날짜_

 | 

주문일

 |
| member\_id  

_최대글자수 : \[32자\]_

 | 

회원아이디

 |
| mileage\_used  

_최소값: \[0\]_  
_최대값: \[99999999999999\]_

 | 

적립금사용금액

 |
| deposit\_used  

_최소값: \[0\]_  
_최대값: \[99999999999999\]_

 | 

예치금사용금액

 |
| payment\_status | 

결제상태

T : 결제  
F : 미결제

 |
| order\_status  

_최대글자수 : \[20자\]_

 | 

주문상태

 |
| payed\_amount  

_최소값: \[0\]_  
_최대값: \[99999999999999\]_

 | 

실결제금액

 |
| bank\_code\_name  

_최대글자수 : \[64자\]_

 | 

입금자 은행명

 |
| bank\_account\_owner\_name  

_최대글자수 : \[32자\]_

 | 

예금주

 |
| payment\_method  

_최대글자수 : \[10자\]_

 | 

결제수단 코드

 |
| buyer | 

주문자정보 리소스

 |
| 

buyer 하위 요소 보기

**name**  
주문자 이름

**zipcode**  
주문자 우편번호

**address**  
주문자 기본 주소

**email**  
주문자 이메일

**phone**  
주문자 일반 전화

**cellphone**  
주문자 휴대 전화

**message**  
배송 메세지







 |
| receivers | 

수령자정보 리소스

 |
| 

receivers 하위 요소 보기

**name**  
수령자명

**zipcode**  
수령자 우편번호

**address**  
수령자 기본 주소

**phone**  
수령자 일반 전화

**cellphone**  
수령자 휴대 전화







 |
| items | 

품주 리소스

 |
| 

items 하위 요소 보기

**order\_item\_code**  
품주코드

**product\_no**  
상품번호

**product\_name**  
상품명

**option**  
상품 옵션 리소스

**quantity**  
수량

**product\_price**  
상품 판매가

**payment\_status**  
결제상태  
T : 결제  
F : 미결제

**order\_status**  
주문상태

**payed\_amount**  
상품구매금액

**total\_payed\_amount**  
품목별 실결제금액







 |

Update order from migrated store

*   [Update order from migrated store](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete order from migrated store [](#delete-order-from-migrated-store)cafe24

DELETE /api/v2/admin/orders/migrations/{order\_id}

###### DELETE

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required**  

_최대글자수 : \[32자\]_

 | 

주문번호

 |

Delete order from migrated store

*   [Delete order from migrated store](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders paymentamount

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20paymentamount.png)  
  
주문의 실결제금액(Orders paymentamount)은 특정 주문의 실제 결제금액에 대한 기능입니다.  
1개 혹은 여러 개의 품주에 대한 실제 결제금액과 관련된 정보를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orders/paymentamount
```

#### \[더보기 상세 내용\]

### Orders paymentamount property list[](#orders-paymentamount-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_item\_code | 

품주코드

 |
| items | 

품목 정보

 |
| order\_price\_amount | 

상품구매금액

 |
| order\_discount\_amount | 

주문 할인금액

 |
| item\_discount\_amount | 

상품 할인금액

 |
| additional\_payment\_amount | 

보조 결제금액

 |
| payment\_amount | 

품목별 결제금액

 |
| cancel\_fee\_amount | 

취소수수료

 |

### Retrieve a payment amount [](#retrieve-a-payment-amount)cafe24 youtube

GET /api/v2/admin/orders/paymentamount

###### GET

특정 주문에 포함된 1개 혹은 여러 개의 품주에 대한 실제 결제금액과 관련된 정보를 목록으로 조회할 수 있습니다.  
상품구매금액, 상품할인금액 등의 값을 조회할 수 있습니다.  
\*\*할인금액 자동계산을 사용하지 않는 품주는 조회할 수 없습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_item\_code**  
**Required** | 

품주코드

,(콤마)로 여러 건을 검색할 수 있다.

 |

Retrieve a payment amount

*   [Retrieve a payment amount](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Orders saleschannels

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Order%20saleschannels.png)  
  
주문 판매채널(Orders saleschannels)은 통해 주문의 판매처의 조회, 등록, 수정, 삭제를 할 수 있습니다.  
주문 판매채널은 하위 리소스로 주문(Orders) 하위에서만 사용할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/orders/saleschannels
POST /api/v2/admin/orders/saleschannels
PUT /api/v2/admin/orders/saleschannels/{sales_channel_id}
DELETE /api/v2/admin/orders/saleschannels/{sales_channel_id}
```

#### \[더보기 상세 내용\]

### Orders saleschannels property list[](#orders-saleschannels-property-list)

| **Attribute** | **Description** |
| --- | --- |
| sales\_channel\_id | 
판매처 아이디

 |
| sales\_channel\_name | 

판매처 이름

 |
| sales\_channel\_icon | 

판매처 아이콘

 |

### Retrieve a list of sales channels [](#retrieve-a-list-of-sales-channels)cafe24

GET /api/v2/admin/orders/saleschannels

###### GET

쇼핑몰에 등록된 판매채널을 목록으로 조회할 수 있습니다.  
판매처의 아이디, 이름, 아이콘 등을 조회할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| limit  
_최소: \[1\]~최대: \[500\]_

 | 

조회결과 최대건수

DEFAULT 10

 |
| offset  

_최대값: \[10000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a list of sales channels

*   [Retrieve a list of sales channels](#none)
*   [Retrieve saleschannels with fields parameter](#none)
*   [Retrieve saleschannels using paging](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a sales channel [](#create-a-sales-channel)cafe24

POST /api/v2/admin/orders/saleschannels

###### POST

쇼핑몰에 판매채널을 등록할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **sales\_channel\_id**  
**Required**  
_최대글자수 : \[40자\]_  
_형식 : \[a-zA-Z0-9\]_

 | 

판매처 아이디

 |
| **sales\_channel\_name**  
**Required**  

_최대글자수 : \[100자\]_

 | 

판매처 이름

 |
| **sales\_channel\_icon**  
**Required**  

_URL_  
_최대글자수 : \[500자\]_

 | 

판매처 아이콘

 |

Create a sales channel

*   [Create a sales channel](#none)
*   [Register sales channel by using only required fields](#none)
*   [Try registering sales channel by without sales\_channel\_id field](#none)
*   [Try registering sales channel by without sales\_channel\_name field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a sales channel [](#update-a-sales-channel)cafe24

PUT /api/v2/admin/orders/saleschannels/{sales\_channel\_id}

###### PUT

쇼핑몰에 등록된 판매채널을 수정할 수 있습니다.  
판매처의 이름, 아이콘 등을 수정할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **sales\_channel\_id**  
**Required**  
_최대글자수 : \[40자\]_  
_형식 : \[a-zA-Z0-9\]_

 | 

판매처 아이디

 |
| sales\_channel\_name  

_최대글자수 : \[100자\]_

 | 

판매처 이름

 |
| sales\_channel\_icon  

_URL_  
_최대글자수 : \[500자\]_

 | 

판매처 아이콘

 |

Update a sales channel

*   [Update a sales channel](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a sales channel [](#delete-a-sales-channel)cafe24

DELETE /api/v2/admin/orders/saleschannels/{sales\_channel\_id}

###### DELETE

쇼핑몰에 판매채널을 삭제할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **sales\_channel\_id**  
**Required**  
_최대글자수 : \[40자\]_  
_형식 : \[a-zA-Z0-9\]_

 | 

판매처 아이디

 |

Delete a sales channel

*   [Delete a sales channel](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Payments

결제상태(Payments)는 특정 주문의 결제상태에 대한 기능입니다.

> Endpoints

```
PUT /api/v2/admin/payments
```

#### \[더보기 상세 내용\]

### Payments property list[](#payments-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| status | 

주문상태

paid: 입금확인  
unpaid: 입금전  
canceled: 결제취소

 |
| payment\_no | 

결제번호

 |
| auto\_paid | 

자동입금 여부

T: 자동입금  
F: 수동입금

 |
| cancel\_request | 

결제취소 요청 정보

 |

### Update payment status for multiple orders [](#update-payment-status-for-multiple-orders)cafe24

PUT /api/v2/admin/payments

###### PUT

특정 주문의 결제상태를 수정할 수 있습니다.  
결제취소 상태로 변경하고자 할 경우, 앱을 통해 등록된 PG사에서 결제를 취소할 경우에만 사용이 가능합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **status**  
**Required** | 

결제상태

canceled의 경우 앱을 통해 추가된 PG사에서 결제를 취소할 경우에만 사용 가능

paid: 입금확인  
unpaid: 입금전  
canceled: 결제취소

 |
| payment\_no  

_최소값: \[1\]_

 | 

결제번호

 |
| auto\_paid | 

자동입금 여부

T: 자동입금  
F: 수동입금

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

 |
| cancel\_request | 

결제취소 요청 정보

 |
| 

cancel\_request 하위 요소 보기

**refund\_status**  
환불 처리 상태  
P: 환불완료  
F: 환불실패  
DEFAULT F

**partial\_cancel**  
부분 취소 여부  
T: 부분취소  
F: 전체취소  
DEFAULT F

**payment\_gateway\_name**  
결제 PG사 이름

**payment\_method**  
결제수단 코드  
card : 신용카드  
tcash : 계좌이체  
icash : 가상계좌  
cell : 휴대폰  
deferpay : 후불  
cvs : 편의점  
easypay : 간편결제  
fpayment : 해외결제

**response\_code**  
결제 PG 사의 응답 코드

**response\_message**  
결제 PG 사의 응답 메시지







 |

Update payment status for multiple orders

*   [Update payment status for multiple orders](#none)
*   [Update the payment status of order to paid](#none)
*   [Update the payment status of order to unpaid](#none)
*   [Try to update the payment status of the order which is shipping](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Refunds

환불(Refunds)은 주문의 상태가 환불과 관련된 상태에 대해 조회할 수 있는 기능입니다.  
환불전, 환불보류, 환불완료 단계가 아닌 주문에 대해서는 조회할 수 없으므로 주문상태를 잘 확인하고 사용해주세요.

> Endpoints

```
GET /api/v2/admin/refunds
GET /api/v2/admin/refunds/{refund_code}
```

#### \[더보기 상세 내용\]

### Refunds property list[](#refunds-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| member\_id | 

회원아이디

 |
| member\_email | 

회원 이메일

 |
| buyer\_email | 

주문자 이메일

 |
| order\_date | 

주문일

 |
| accepted\_refund\_date | 

환불접수일자

 |
| refund\_date | 

환불완료일자

 |
| order\_id | 

주문번호

 |
| refund\_code | 

환불번호

 |
| order\_item\_code | 

품주코드 목록

 |
| quantity | 

수량

 |
| actual\_refund\_amount | 

실환불금액

 |
| used\_points | 

사용된 적립금 반환액

 |
| used\_credits | 

사용된 예치금 반환액

 |
| currency | 

화폐단위

 |
| payment\_methods | 

결제수단

cash : 무통장  
card : 신용카드  
cell : 휴대폰  
tcash : 계좌이체  
icash : 가상계좌  
prepaid : 선불금  
credit : 예치금  
point : 적립금  
pointfy : 통합포인트  
cvs : 편의점  
cod : 후불  
coupon : 쿠폰  
market\_discount : 마켓할인  
giftcard : 제휴상품권  
pointcard : 제휴포인트  
etc : 기타

 |
| refund\_payment\_methods | 

환불 결제수단

cash : 무통장  
card : 신용카드  
cell : 휴대폰  
tcash : 계좌이체  
prepaid : 선불금  
credit : 예치금  
point : 적립금  
pointfy : 통합포인트  
cvs : 편의점  
cod : 후불  
giftcard : 제휴상품권  
pointcard : 제휴포인트  
etc : 기타

 |
| payment\_gateway\_cancel\_statuses | 

PG 취소상태

F : 취소전  
M : 부분취소 완료  
T : 전체취소 완료

 |
| payment\_gateway\_cancel\_dates | 

PG 취소처리 일자

 |
| status | 

환불상태

T : 환불완료  
F : 환불전

 |
| refund\_methods | 

환불 방식

 |
| refund\_bank\_name | 

환불은행명

 |
| refund\_bank\_account\_no | 

환불 계좌번호

 |
| refund\_bank\_account\_holder | 

환불계좌 예금주 명의

 |
| include\_tax | 

가격에 세금 포함

T: 세금포함  
F: 세금제외

 |
| tax | 

세금 정보

세금 관리자 앱을 사용 안 할 경우 null로 반환

 |
| cancel\_fee\_amount | 

취소수수료

 |
| refund\_point | 

적립금 반환액

 |
| refund\_credit | 

예치금 반환액

 |
| refund\_naver\_point | 

네이버 포인트 반환액

 |
| refund\_naver\_cash | 

네이버 캐시 반환액

 |
| refund\_amount | 

환불금액

 |
| product\_price | 

상품 판매가

 |
| shipping\_fee | 

배송비

DEFAULT 0.00

 |
| refund\_shipping\_fee | 

환불배송비

DEFAULT 0.00

 |
| refund\_regional\_surcharge | 

지역별 환불배송비

DEFAULT 0.00

 |
| return\_shipping\_fee | 

반품배송비

DEFAULT 0.00

 |
| return\_regional\_surcharge | 

지역별 반품배송비

DEFAULT 0.00

 |
| additional\_shipping\_fee | 

추가 배송비

DEFAULT 0.00

 |
| international\_shipping\_insurance | 

해외배송 보험료

DEFAULT 0.00

 |
| international\_shipping\_additional\_fee | 

해외배송 부가금액

DEFAULT 0.00

 |
| shipping\_fee\_discount\_amount | 

배송비할인

 |
| cod\_fees | 

후불 결제 수수료

 |
| product\_discount\_amount | 

상품별 할인금액

 |
| member\_group\_discount\_amount | 

회원등급 할인금액

 |
| app\_item\_discount\_amount | 

앱 상품할인금액

 |
| app\_discount\_amount | 

앱 주문할인금액​​​

 |
| coupon\_discount\_amount | 

쿠폰 할인금액

 |
| product\_bundle\_discount\_amount | 

세트상품 할인금액

 |
| points\_spent\_amount | 

적립금사용금액

 |
| credits\_spent\_amount | 

예치금사용금액

 |
| naver\_point | 

네이버포인트

 |
| naver\_cash | 

네이버캐시

 |
| additional\_product\_amount | 

상품 추가 결제금액

 |
| manually\_input\_amount | 

관리자 입력 금액

 |
| changed\_refund\_amount | 

변경된 환불금액

 |
| refund\_manager | 

환불 담당자

 |
| refund\_reason | 

환불사유

 |
| send\_sms | 

환불처리후 SMS 발송 여부

T : 발송함  
F : 발송안함

 |
| send\_mail | 

환불처리후 메일 발송 여부

T : 발송함  
F : 발송안함

 |
| items | 

품주 리소스

 |

### Retrieve a list of refunds [](#retrieve-a-list-of-refunds)cafe24 youtube

GET /api/v2/admin/refunds

###### GET

환불과 관련된 상태인 주문들을 목록으로 조회할 수 있습니다.  
회원 이메일, 주문일, 환불접수일자 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **start\_date**  
**Required**  

_날짜_

 | 

검색 시작일

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

 |
| date\_type | 

검색날짜 유형

accepted\_refund\_date : 환불접수일  
refund\_date : 환불완료일

DEFAULT refund\_date

 |
| member\_email | 

회원 이메일

 |
| buyer\_email | 

주문자 이메일

 |
| order\_id  

_주문번호_

 | 

주문번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| refund\_status | 

CS(환불)상태

,(콤마)로 여러 건을 검색할 수 있다.

F : 환불전  
T : 환불완료  
M : 환불보류

 |
| limit  

_최소: \[1\]~최대: \[500\]_

 | 

조회결과 최대건수

DEFAULT 10

 |
| offset  

_최대값: \[15000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a list of refunds

*   [Retrieve a list of refunds](#none)
*   [Retrieve refunds with fields parameter](#none)
*   [Retrieve refunds using paging](#none)
*   [Retrieve multiple refunds](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a refund [](#retrieve-a-refund)cafe24 youtube

GET /api/v2/admin/refunds/{refund\_code}

###### GET

특정 환불번호에 대한 정보를 조회할 수 있습니다.  
환불 사유, 환불 결제 수당 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **refund\_code**  
**Required** | 

환불번호

 |
| items  
**embed** | 

품주 리소스

 |

Retrieve a refund

*   [Retrieve a refund](#none)
*   [Retrieve a refund with fields parameter](#none)
*   [Retrieve a refund with embed](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Reservations

예약주문관련 기능을 제공합니다.

> Endpoints

```
GET /api/v2/admin/reservations
```

#### \[더보기 상세 내용\]

### Reservations property list[](#reservations-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| order\_id | 

주문번호

 |
| order\_item\_code | 

품주코드

 |
| order\_date | 

주문일

 |
| payment\_date | 

결제일

 |
| member\_id | 

회원아이디

 |
| order\_status | 

주문상태

 |
| shipping\_code | 

배송번호

 |
| payment\_method | 

결제수단 코드

cash : 무통장  
card : 신용카드  
cell : 휴대폰  
tcash : 계좌이체  
icash : 가상계좌  
prepaid : 선불금  
credit : 예치금  
point : 적립금  
pointfy : 통합포인트  
cvs : 편의점  
cod : 후불  
coupon : 쿠폰  
market\_discount : 마켓할인  
giftcard : 제휴상품권  
pointcard : 제휴포인트  
etc : 기타

 |
| payment\_method\_name | 

결제수단명

 |
| product\_no | 

상품번호

 |
| product\_name | 

상품명

 |
| product\_name\_default | 

기본 상품명

 |
| product\_price | 

상품 판매가

 |
| option\_price | 

옵션 추가 가격

 |
| quantity | 

수량

 |
| option\_value | 

옵션값

 |
| option\_value\_default | 

기본옵션값

 |
| additional\_option\_values | 

추가입력 옵션 목록

 |
| payment\_amount | 

품목별 결제금액

 |
| paid | 

결제 여부

T : 결제  
F : 미결제  
M : 부분 결제

 |
| service\_use\_date | 

서비스 이용일

 |
| service\_available\_start\_date | 

서비스 이용가능기간 시작일

 |
| service\_available\_end\_date | 

서비스 이용가능기간 종료일

 |
| service\_completion\_date | 

서비스 이용 완료일

 |
| cancel\_fee\_amount | 

취소수수료

 |

### Retrieve a booked item [](#retrieve-a-booked-item)cafe24

GET /api/v2/admin/reservations

###### GET

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| date\_type | 

검색날짜 유형

order\_date: 주문일  
pay\_date: 결제일  
service\_use\_date: 서비스 이용일

DEFAULT order\_date

 |
| start\_date  

_날짜_

 | 

검색 시작일

 |
| end\_date  

_날짜_

 | 

검색 종료일

 |
| order\_id  

_주문번호_

 | 

주문번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| order\_item\_code | 

품주코드

,(콤마)로 여러 건을 검색할 수 있다.

 |
| buyer\_name | 

주문자명

 |
| member\_id | 

회원아이디

 |
| member\_email | 

회원 이메일

 |
| buyer\_email | 

주문자 이메일

 |
| buyer\_cellphone | 

주문자 휴대 전화

 |
| product\_no | 

상품번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| order\_status | 

주문상태

,(콤마)로 여러 건을 검색할 수 있다.

N00 : 입금전  
N10 : 상품준비중  
N20 : 배송준비중  
N21 : 배송대기  
N22 : 배송보류  
N30 : 배송중  
N40 : 배송완료  
N50 : 구매확정  
C00 : 취소신청  
C10 : 취소접수 - 관리자  
C11 : 취소접수거부 - 관리자  
C34 : 취소처리중 - 환불전  
C35 : 취소처리중 - 환불완료  
C36 : 취소처리중 - 환불보류  
C40 : 취소완료  
C41 : 취소 완료 - 환불전  
C42 : 취소 완료 - 환불요청중  
C43 : 취소 완료 - 환불보류  
C47 : 입금전취소 - 구매자  
C48 : 입금전취소 - 자동취소  
C49 : 입금전취소 - 관리자  
R00 : 반품신청  
R10 : 반품접수  
R11 : 반품 접수 거부  
R12 : 반품보류  
R13 : 반품접수 - 수거완료(자동)  
R20 : 반품 수거 완료  
R30 : 반품처리중 - 수거전  
R31 : 반품처리중 - 수거완료  
R34 : 반품처리중 - 환불전  
R36 : 반품처리중 - 환불보류  
R40 : 반품완료 - 환불완료  
R41 : 반품완료 - 환불전  
R42 : 반품완료 - 환불요청중  
R43 : 반품완료 - 환불보류  
E00 : 교환신청  
E10 : 교환접수  
N01 : 교환접수 - 교환상품  
E11 : 교환접수거부  
E12 : 교환보류  
E13 : 교환접수 - 수거완료(자동)  
E20 : 교환준비  
E30 : 교환처리중 - 수거전  
E31 : 교환처리중 - 수거완료  
E32 : 교환처리중 - 입금전  
E33 : 교환처리중 - 입금완료  
E34 : 교환처리중 - 환불전  
E35 : 교환처리중 - 환불완료  
E36 : 교환처리중 - 환불보류  
E40 : 교환완료  
E41 : 교환 완료 - 교환철회  
E50 : 교환철회 - 판매자  
E51 : 교환철회 - 구매자

 |
| payment\_status | 

결제상태

F : 입금전  
M : 추가입금대기  
P : 결제완료

 |
| receiver\_name | 

수령자명

 |
| receiver\_cellphone | 

수령자 휴대 전화

 |
| supplier\_id | 

공급사 아이디

,(콤마)로 여러 건을 검색할 수 있다.

 |
| supplier\_name  

_최대글자수 : \[100자\]_

 | 

공급사명

 |
| sort | 

정렬 순서 값

order\_date: 주문일  
service\_use\_date: 서비스 이용일

DEFAULT order\_date

 |
| order | 

정렬 순서

asc : 순차정렬  
desc : 역순 정렬

DEFAULT desc

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve a booked item

*   [Retrieve a booked item](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Return

반품(Return)은 쇼핑몰 고객이 배송 후 주문을 취소하는 것을 의미합니다.  
반품 리소스는 반품접수 이후부터 반품완료까지의 주문 상태를 조회할 수 있습니다.  
반품 리소스에서는 반품 정보를 조회하거나 반품을 처리할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/return/{claim_code}
POST /api/v2/admin/return
PUT /api/v2/admin/return
```

#### \[더보기 상세 내용\]

### Return property list[](#return-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| claim\_code | 

반품번호

 |
| claim\_reason\_type | 

구분

판매자의 반품 접수 사유 구분.  
구매자의 반품 신청 사유는 items(품목 주문) > claim\_reason\_type으로 조회할 수 있다.

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| claim\_reason | 

사유

판매자의 반품 접수 사유 상세 내용.  
구매자의 반품 신청 사유 상세 내용은 items(품목 주문) > claim\_reason으로 조회할 수 있다.

 |
| claim\_due\_date | 

반품처리 예정일

 |
| return\_address | 

반품주소

 |
| pickup | 

수거지역 상세

 |
| return\_invoice\_no  

_최대글자수 : \[40자\]_

 | 

반품 송장 번호

 |
| return\_shipping\_company\_name  

_최대글자수 : \[30자\]_

 | 

반품 배송업체명

 |
| pickup\_request\_state | 

수거 신청 상태

E : 수거 미신청  
W : 수거 미접수  
S : 수거접수대기(송장발급전)  
F : 수거접수실패  
T : 수거접수완료(송장발급완료)  
N : 미집하

 |
| refund\_methods | 

환불 방식

 |
| refund\_reason | 

비고

 |
| order\_price\_amount | 

상품구매금액

 |
| refund\_amounts | 

환불금액

 |
| shipping\_fee | 

배송비

DEFAULT 0.00

 |
| refund\_shipping\_fee | 

환불배송비

DEFAULT 0.00

 |
| refund\_regional\_surcharge | 

지역별 환불배송비

DEFAULT 0.00

 |
| return\_ship\_type | 

반품배송비 적용구분

 |
| return\_shipping\_fee | 

반품배송비

DEFAULT 0.00

 |
| return\_shipping\_fee\_detail | 

반품배송비 상세

 |
| return\_regional\_surcharge | 

지역별 반품배송비

DEFAULT 0.00

 |
| return\_regional\_surcharge\_detail | 

지역별 반품배송비 상세

 |
| additional\_shipping\_fee | 

추가 배송비

DEFAULT 0.00

 |
| international\_shipping\_insurance | 

해외배송 보험료

DEFAULT 0.00

 |
| international\_shipping\_additional\_fee | 

해외배송 부가금액

DEFAULT 0.00

 |
| defer\_commission | 

후불 결제 수수료

 |
| partner\_discount\_amount | 

제휴할인 취소액

 |
| add\_discount\_amount | 

상품별추가할인 취소액

 |
| member\_grade\_discount\_amount | 

회원등급할인 취소액

 |
| shipping\_discount\_amount | 

배송비할인 취소액

 |
| coupon\_discount\_amount | 

쿠폰할인 취소액

 |
| point\_used | 

사용된 적립금 반환액

 |
| credit\_used | 

사용된 예치금 반환액

 |
| undone | 

철회 여부

T : 철회함  
F : 철회안함

 |
| undone\_reason\_type | 

철회 사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| undone\_reason | 

철회 사유

 |
| expose\_order\_detail | 

주문상세내역 노출 여부

T : 노출함  
F : 노출안함

 |
| exposed\_undone\_reason | 

주문상세내역 노출 철회 사유

 |
| items | 

품주코드

 |
| include\_tax | 

가격에 세금 포함

T: 세금포함  
F: 세금제외

 |
| tax | 

세금 정보

세금 관리자 앱을 사용 안 할 경우 null로 반환

 |
| carrier\_id | 

배송사 아이디

 |
| return\_invoice\_success | 

반송장 처리 성공 여부

T : 성공  
F : 실패  
N : 미집하

 |
| return\_invoice\_fail\_reason | 

반송장 처리 실패 사유

 |
| cancel\_fee\_amount | 

취소수수료

 |
| status | 

주문상태

accepted : 반품접수  
processing : 반품처리중  
returned : 반품완료

 |
| pickup\_completed | 

수거완료 여부

T : 수거완료  
F : 수거전

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

 |
| request\_pickup | 

수거신청 여부

T : 사용함  
F : 사용안함

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

 |

### Retrieve a return [](#retrieve-a-return)cafe24 youtube

GET /api/v2/admin/return/{claim\_code}

###### GET

주문의 반품 정보를 조회할 수 있습니다.  
반품번호는 필수 입력값입니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **claim\_code**  
**Required** | 

반품번호

 |

Retrieve a return

*   [Retrieve a return](#none)
*   [Retrieve a return with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create multiple order returns [](#create-multiple-order-returns)cafe24 youtube

POST /api/v2/admin/return

###### POST

여러 배송 후 주문을 반품 처리할 수 있는 기능입니다.  
해당 API를 사용하여 반품 처리할 경우 환불완료까지 처리 되지만 PG 취소까지는 진행되지 않으므로, 솔루션에서 별도 PG 취소처리를 해주어야 합니다.  
부분반품할 경우 각 환불 금액은 자동 계산되어 환불처리됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **status**  
**Required** | 

주문상태

accepted : 반품접수  
processing : 반품처리중  
returned : 반품완료

 |
| pickup\_completed | 

수거완료 여부

T : 수거완료  
F : 수거전

DEFAULT F

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

DEFAULT F

 |
| recover\_coupon | 

쿠폰 복원

**Youtube shopping 이용 시에는 미제공**

T : 복구함  
F : 복구안함

DEFAULT F

 |
| recover\_coupon\_no | 

복원할 쿠폰 번호

**Youtube shopping 이용 시에는 미제공**

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

DEFAULT F

 |
| reason  

_최대글자수 : \[2000자\]_

 | 

반품사유

 |
| claim\_reason\_type | 

반품사유 구분

A : 고객변심  
B : 배송지연  
C : 배송불가지역  
L : 수출/통관 불가  
D : 포장불량  
E : 상품불만족  
F : 상품정보상이  
G : 서비스불만족  
H : 품절  
I : 기타

 |
| naverpay\_return\_reason\_type | 

네이버페이 반품사유 구분

**Youtube shopping 이용 시에는 미제공**

카카오페이 주문을 반품할 경우 사용 불가

**EC 베트남, 필리핀, 일본 버전에서는 사용할 수 없음.**

51 : 구매 의사 취소  
52 : 색상 및 사이즈 변경  
53 : 다른 상품 잘못 주문  
54 : 서비스 및 상품 불만족  
55 : 배송 지연  
56 : 상품 품절  
57 : 배송 누락  
58 : 미배송  
59 : 상품 파손  
60 : 상품 정보 상이  
61 : 오배송  
62 : 색상 등 옵션이 다른 상품 잘못 배송

 |
| refund\_method\_code | 

환불 방식

T : 현금  
F : 신용카드  
M : 적립금  
G : 계좌이체  
C : 휴대폰  
D : 예치금  
Z : 후불  
O : 선불금  
V : 편의점  
J : 제휴상품권  
K : 제휴포인트  
I : 기타

 |
| refund\_bank\_code | 

환불 은행 코드

환불 방식(refund\_method)이 현금(T)일 경우 필수  
  
[refund\_bank\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/refund_bank_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)  
  
※ 해당 쇼핑몰이 EC Korea 쇼핑몰일 경우 필수

 |
| refund\_bank\_name  

_최대글자수 : \[250자\]_

 | 

환불은행명

환불 방식(refund\_method)이 현금(T)일 경우 필수  
  
※ 해당 쇼핑몰이 EC Global 쇼핑몰일 경우 필수  
환불수단(refund\_method)이 "현금(T)"일 때만 사용 가능

 |
| refund\_bank\_account\_no | 

환불 계좌번호

환불수단(refund\_method)이 "현금(T)"일 때만 사용 가능

 |
| refund\_bank\_account\_holder  

_최대글자수 : \[15자\]_

 | 

환불계좌 예금주 명의

 |
| items | 

품주코드

 |
| 

items 하위 요소 보기

**order\_item\_code**  
**Required**  
품주코드

**quantity**  
**Required**  
수량







 |
| request\_pickup | 

수거신청 여부

T : 사용함  
F : 사용안함

 |
| pickup | 

수거지역 상세

 |
| 

pickup 하위 요소 보기

**name**  
이름

**phone**  
전화번호

**cellphone**  
휴대전화

**zipcode**  
우편번호

**address1**  
기본 주소

**address2**  
상세 주소







 |
| return\_invoice\_no  

_최대글자수 : \[40자\]_

 | 

반품 송장 번호

 |
| return\_shipping\_company\_name  

_최대글자수 : \[30자\]_

 | 

반품 배송업체명

 |

Create multiple order returns

*   [Create multiple order returns](#none)
*   [Return multiple orders](#none)
*   [Try to return multiple orders without status parameter](#none)
*   [Return specific item of multiple orders](#none)
*   [Return multiple orders and refund to card and cash](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a return [](#update-a-return)cafe24 youtube

PUT /api/v2/admin/return

###### PUT

주문의 반품접수상태를 수정하는 기능입니다.  
반품이 접수된 주문을 수정할 수 있습니다.  
Update return 을 통해 반품접수를 철회하거나, 재고를 복구하거나, 철회사유를 입력할 수 있습니다.  
택배사에 이미 수거요청이 전달되었으나 수거가 필요하지 않게 될 경우, 택배사에 직접 연락하셔서 수거요청을 취소해주셔야 합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **claim\_code**  
**Required** | 

반품번호

 |
| status | 

주문상태

processing : 반품처리중  
returned : 반품완료

 |
| pickup\_completed | 

수거완료 여부

T : 수거완료  
F : 수거전

 |
| carrier\_id | 

배송사 아이디

배송사에서 반송장번호 업데이트시 carrier\_id 필수

 |
| refund\_method\_code | 

환불 방식

T : 현금  
F : 신용카드  
M : 적립금  
G : 계좌이체  
C : 휴대폰  
D : 예치금  
Z : 후불  
O : 선불금  
V : 편의점  
J : 제휴상품권  
K : 제휴포인트  
I : 기타

 |
| refund\_bank\_account\_holder  

_최대글자수 : \[15자\]_

 | 

환불계좌 예금주 명의

 |
| return\_invoice\_no  

_최대글자수 : \[40자\]_

 | 

반품 송장 번호

 |
| return\_shipping\_company\_name  

_최대글자수 : \[30자\]_

 | 

반품 배송업체명

 |
| return\_invoice\_success | 

반송장 처리 성공 여부

T : 성공  
F : 실패  
N : 미집하

 |
| return\_invoice\_fail\_reason  

_최대글자수 : \[100자\]_

 | 

반송장 처리 실패 사유

 |
| items | 

품주코드

 |
| 

items 하위 요소 보기

**order\_item\_code**  
품주코드







 |
| recover\_coupon | 

쿠폰 복원

**Youtube shopping 이용 시에는 미제공**

T : 복구함  
F : 복구안함

 |
| recover\_coupon\_no | 

복원할 쿠폰 번호

**Youtube shopping 이용 시에는 미제공**

 |
| recover\_inventory | 

재고복구

T : 복구함  
F : 복구안함

 |
| request\_pickup | 

수거신청 여부

반송지 저장시 기본값은 "수거신청함(T)"

T : 사용함  
F : 사용안함

 |
| pickup | 

수거지역 상세

 |
| 

pickup 하위 요소 보기

**name**  
이름

**phone**  
전화번호

**cellphone**  
휴대전화

**zipcode**  
우편번호

**address1**  
기본 주소

**address2**  
상세 주소







 |
| undone | 

철회 여부

T : 철회함

 |
| add\_memo\_too | 

관리자 메모에도 추가

T : 사용함  
F : 사용안함

 |
| undone\_reason\_type | 

철회 사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| undone\_reason  

_최대글자수 : \[2000자\]_

 | 

철회 사유

 |
| expose\_order\_detail | 

주문상세내역 노출 여부

T : 노출함  
F : 노출안함

 |
| exposed\_undone\_reason  

_최대글자수 : \[2000자\]_

 | 

주문상세내역 노출 철회 사유

 |
| refund\_bank\_code | 

환불 은행 코드

 |
| refund\_bank\_name  

_최대글자수 : \[250자\]_

 | 

환불은행명

 |
| refund\_bank\_account\_no | 

환불 계좌번호

 |

Update a return

*   [Update a return](#none)
*   [Update pickup status of mutiple orders for return](#none)
*   [Withdraw the return(mutiple orders)](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Returnrequests

반품요청(Returnrequests)을 통해 특정 주문의 반품에 대한 요청을 접수하거나 거부할 수 있습니다.

> Endpoints

```
POST /api/v2/admin/returnrequests
PUT /api/v2/admin/returnrequests
```

#### \[더보기 상세 내용\]

### Returnrequests property list[](#returnrequests-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| order\_id | 

주문번호

 |
| items | 

품주 목록

 |
| undone | 

접수거부 여부

 |
| order\_item\_code | 

품주코드

 |
| additional\_payment\_gateway\_cancel | 

추가 PG 취소

 |

### Create a return request for multiple items [](#create-a-return-request-for-multiple-items)cafe24 youtube

POST /api/v2/admin/returnrequests

###### POST

반품을 요청할 수 있습니다.  
반품사유와 계좌환불인 경우 환불할 계좌번호를 입력할 수 있습니다.  
,(콤마)로 여러 건을 동시에 반품요청 할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **reason\_type**  
**Required** | 

사유 구분

A:고객변심  
E:상품불만족  
K:상품불량  
J:배송오류  
I:기타

 |
| **reason**  
**Required**  

_최대글자수 : \[2000자\]_

 | 

사유

 |
| **request\_pickup**  
**Required** | 

수거신청 여부

T : 수거신청  
F : 직접발송

 |
| pickup | 

수거지역 상세

 |
| 

pickup 하위 요소 보기

**name**  
**Required**  
이름

**phone**  
전화번호

**cellphone**  
**Required**  
휴대전화

**zipcode**  
우편번호

**address1**  
**Required**  
기본 주소

**address2**  
**Required**  
상세 주소







 |
| tracking\_no  

_최대글자수 : \[40자\]_

 | 

반품 송장 번호

 |
| shipping\_company\_name  

_최대글자수 : \[30자\]_

 | 

반품 배송업체명

 |
| refund\_bank\_code | 

환불 은행 코드

 |
| refund\_bank\_name  

_최대글자수 : \[250자\]_

 | 

환불은행명

 |
| refund\_bank\_account\_no | 

환불 계좌번호

 |
| refund\_bank\_account\_holder  

_최대글자수 : \[15자\]_

 | 

환불계좌 예금주 명의

 |
| items | 

품주 목록

 |
| 

items 하위 요소 보기

**order\_item\_code**  
**Required**  
품주코드

**quantity**  
**Required**  
수량







 |

Create a return request for multiple items

*   [Create a return request for multiple items](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Reject a return request for multiple items [](#reject-a-return-request-for-multiple-items)cafe24 youtube

PUT /api/v2/admin/returnrequests

###### PUT

반품이 요청된 주문의 특정 품주들에 대하여 반품요청중인 상태를 변경할 수 있습니다.  
접수거부를 할 수 있고 사유를 입력할 수 있습니다.  
,(콤마)로 여러 건의 반품 요청을 동시에 접수거부 할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **order\_id**  
**Required** | 

주문번호

 |
| **order\_item\_code**  
**Required** | 

품주코드

 |
| **undone**  
**Required** | 

접수거부 여부

T : 접수거부함

 |
| reason\_type | 

사유 구분

A:고객변심  
B:배송지연  
J:배송오류  
C:배송불가지역  
L:수출/통관 불가  
D:포장불량  
E:상품 불만족  
F:상품정보상이  
K:상품불량  
G:서비스불만족  
H:품절  
I:기타

 |
| reason  

_최대글자수 : \[2000자\]_

 | 

사유

 |
| display\_reject\_reason | 

주문상세내역 노출설정

T : 노출함  
F : 노출안함

DEFAULT F

 |
| reject\_reason  

_최대글자수 : \[2000자\]_

 | 

거부 사유

 |

Reject a return request for multiple items

*   [Reject a return request for multiple items](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Shipments

배송(Shipments)은 주문의 하위리소스인 주문의 배송(Orders shipments)과 다르게 여러 주문의 배송 정보를 한번에 등록하거나 수정할 수 있습니다.  
배송 정보에는 송장번호와 배송사 정보, 배송 상태 등이 있습니다.

> Endpoints

```
POST /api/v2/admin/shipments
PUT /api/v2/admin/shipments
```

#### \[더보기 상세 내용\]

### Shipments property list[](#shipments-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| tracking\_no | 

송장번호

 |
| shipping\_company\_code | 

배송업체 코드

[shipping\_company\_code](https://s3.ap-northeast-2.amazonaws.com/appservice-guide/resource/ko/shipping_company_code_kr.csv) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| status | 

주문상태

standby : 배송대기  
shipping : 배송중  
shipped : 배송완료

 |
| order\_id | 

주문번호

 |
| shipping\_code | 

배송번호

 |
| order\_item\_code | 

품주코드

 |
| carrier\_id | 

배송��� 아이디

 |
| status\_additional\_info | 

주문상태 추가정보

 |

### Create shipping information for multiple orders [](#create-shipping-information-for-multiple-orders)cafe24 youtube

POST /api/v2/admin/shipments

###### POST

복수의 주문에 대하여 송장번호를 등록하여 배송대기나 배송중 상태로 변경할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **tracking\_no**  
**Required**  

_최대글자수 : \[40자\]_

 | 

송장번호

 |
| **shipping\_company\_code**  
**Required** | 

배송업체 코드

[shipping\_company\_code](https://s3.ap-northeast-2.amazonaws.com/appservice-guide/resource/ko/shipping_company_code_kr.csv) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| **status**  
**Required** | 

주문상태

standby : 배송대기  
shipping : 배송중

 |
| order\_id | 

주문번호

 |
| shipping\_code | 

배송번호

 |
| order\_item\_code | 

품주코드

 |
| carrier\_id | 

배송사 아이디

 |

Create shipping information for multiple orders

*   [Create shipping information for multiple orders](#none)
*   [Standby multiple shipments with tracking number](#none)
*   [Process multiple shipments with tracking number](#none)
*   [Process specific item of multiple orders](#none)
*   [Process multiple shipments with shipping code](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update multiple order shippings [](#update-multiple-order-shippings)cafe24 youtube

PUT /api/v2/admin/shipments

###### PUT

복수의 배송번호에 대하여 주문상태를 변경하거나 송장번호 등을 수정할 수 있습니다.  
배송번호는 Create shipments 를 통해 송장번호를 등록해야만 발급받을 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **shipping\_code**  
**Required** | 

배송번호

 |
| order\_id | 

주문번호

 |
| status | 

주문상태

status 사용하여 배송상태 수정시 tracking\_no, shipping\_company\_code는 사용 불가

standby : 배송대기  
shipping : 배송중  
shipped : 배송완료

 |
| status\_additional\_info  

_최대글자수 : \[30자\]_

 | 

주문상태 추가정보

 |
| tracking\_no  

_최대글자수 : \[40자\]_

 | 

송장번호

tracking\_no 사용시 shipping\_company\_code를 함께 사용해야 하며, 송장번호 수정시 status는 사용 불가

 |
| shipping\_company\_code | 

배송업체 코드

해당 주문의 송장번호와 함께 배송사를 변경할 수 있다.  
  
[shipping\_company\_code](https://s3.ap-northeast-2.amazonaws.com/appservice-guide/resource/ko/shipping_company_code_kr.csv) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)  
  
tracking\_no 사용시 shipping\_company\_code를 함께 사용해야 하며, 송장번호 수정시 status는 사용 불가

 |

Update multiple order shippings

*   [Update multiple order shippings](#none)
*   [Update shipment status of multiple orders to standby](#none)
*   [Change tracking number and shipping company of mutiple orders](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Subscription shipments

정기배송(Subscription shipments)은 정기배송에 대한 조회, 등록, 수정, 삭제를 할 수 있는 기능입니다.

> Endpoints

```
GET /api/v2/admin/subscription/shipments
POST /api/v2/admin/subscription/shipments
PUT /api/v2/admin/subscription/shipments/{subscription_id}
```

#### \[더보기 상세 내용\]

### Subscription shipments property list[](#subscription-shipments-property-list)

| **Attribute** | **Description** |
| --- | --- |
| subscription\_id | 
정기배송 신청번호

 |
| member\_id | 

회원아이디

 |
| buyer\_name | 

주문자 이름

 |
| buyer\_zipcode | 

주문자 우편번호

 |
| buyer\_address1 | 

주문자 기본 주소

 |
| buyer\_address2 | 

주문자 상세 주소

 |
| buyer\_phone | 

주문자 일반 전화

 |
| buyer\_cellphone | 

주문자 휴대 전화

 |
| buyer\_email | 

주문자 이메일

 |
| receiver\_name  

_최대글자수 : \[100자\]_

 | 

수령자 명

 |
| receiver\_zipcode | 

수령자 우편번호

 |
| receiver\_address1 | 

수령자 기본 주소

 |
| receiver\_address2 | 

수령자 상세 주소

 |
| receiver\_phone | 

수령자 일반 전화

 |
| receiver\_cellphone | 

수령자 휴대 전화

 |
| shipping\_message | 

배송 메세지

 |
| delivery\_type | 

배송 유형

A : 국내  
B : 해외

 |
| wished\_delivery | 

희망배송일 사용여부

T : 사용함  
F : 사용안함

 |
| wished\_delivery\_start\_hour | 

희망배송시작시간

 |
| wished\_delivery\_end\_hour | 

희망배송종료시간

 |
| wished\_delivery\_hour\_asap | 

가능한 빠른 배송시간

T : 사용함  
F : 사용안함

 |
| store\_pickup | 

스토어픽업

T : 사용함  
F : 사용안함

 |
| use\_virtual\_phone\_no | 

안심번호

T : 사용함  
F : 사용안함

 |
| created\_date | 

신청일자

 |
| subscription\_state | 

정기배송 상태

U:이용중  
P: 일시정지  
C:해지

 |
| items | 

주문상품목록

 |

### Retrieve a subscription [](#retrieve-a-subscription)cafe24

GET /api/v2/admin/subscription/shipments

###### GET

정기배송을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| date\_type | 
검색날짜 유형

created\_date : 신청일  
expected\_pay\_date : 결제예정일  
terminated\_date : 해지일

DEFAULT created\_date

 |
| **start\_date**  
**Required**  

_날짜_

 | 

검색 시작일

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

 |
| subscription\_id | 

정기배송 신청번호

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| buyer\_name  

_최대글자수 : \[100자\]_

 | 

주문자 이름

 |
| buyer\_phone | 

주문자 일반 전화

 |
| buyer\_cellphone | 

주문자 휴대 전화

 |
| product\_no | 

상품번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| product\_name  

_최대글자수 : \[250자\]_

 | 

상품명

 |
| product\_code | 

상품코드

 |
| variant\_code | 

품목코드

 |
| subscription\_shipments\_cycle | 

배송주기

,(콤마)로 여러 건을 검색할 수 있다.

1W : 1주  
2W : 2주  
3W : 3주  
4W : 4주  
1M : 1개월  
2M : 2개월  
3M : 3개월  
4M : 4개월  
5M : 5개월  
6M : 6개월  
1Y : 1년

 |
| subscription\_state | 

정기배송 상태

U:이용중  
P: 일시정지  
C:해지

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 20

 |
| offset  

_최대값: \[5000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a subscription

*   [Retrieve a subscription](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a subscription [](#create-a-subscription)cafe24

POST /api/v2/admin/subscription/shipments

###### POST

정기배송을 등록할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| **buyer\_name**  
**Required**  

_최대글자수 : \[100자\]_

 | 

주문자 이름

 |
| **buyer\_zipcode**  
**Required**  

_글자수 최소: \[2자\]~최대: \[14자\]_

 | 

주문자 우편번호

 |
| **buyer\_address1**  
**Required**  

_최대글자수 : \[250자\]_

 | 

주문자 기본 주소

 |
| **buyer\_address2**  
**Required** | 

주문자 상세 주소

 |
| buyer\_phone  

_최대글자수 : \[20자\]_

 | 

주문자 일반 전화

 |
| **buyer\_cellphone**  
**Required**  

_최대글자수 : \[20자\]_

 | 

주문자 휴대 전화

 |
| **buyer\_email**  
**Required**  

_이메일_

 | 

주문자 이메일

 |
| **receiver\_name**  
**Required**  

_최대글자수 : \[100자\]_

 | 

수령자 명

 |
| **receiver\_zipcode**  
**Required**  

_글자수 최소: \[2자\]~최대: \[13자\]_

 | 

수령자 우편번호

 |
| **receiver\_address1**  
**Required** | 

수령자 기본 주소

 |
| **receiver\_address2**  
**Required** | 

수령자 상세 주소

 |
| **receiver\_phone**  
**Required**  

_최대글자수 : \[20자\]_

 | 

수령자 일반 전화

 |
| **receiver\_cellphone**  
**Required**  

_최대글자수 : \[20자\]_

 | 

수령자 휴대 전화

 |
| shipping\_message | 

배송 메세지

 |
| delivery\_type | 

배송 유형

A : 국내  
B : 해외

DEFAULT A

 |
| **expected\_delivery\_date**  
**Required**  

_날짜_

 | 

배송시작일

 |
| **subscription\_shipments\_cycle**  
**Required** | 

배송주기

1W : 1주  
2W : 2주  
3W : 3주  
4W : 4주  
1M : 1개월  
2M : 2개월  
3M : 3개월  
4M : 4개월  
5M : 5개월  
6M : 6개월  
1Y : 1년

 |
| wished\_delivery | 

희망배송일 사용여부

T : 사용함  
F : 사용안함

DEFAULT F

 |
| wished\_delivery\_start\_hour  

_최소: \[0\]~최대: \[23\]_

 | 

희망배송시작시간

 |
| wished\_delivery\_end\_hour  

_최소: \[0\]~최대: \[23\]_

 | 

희망배송종료시간

 |
| wished\_delivery\_hour\_asap | 

가능한 빠른 배송시간

T : 사용함  
F : 사용안함

 |
| store\_pickup | 

스토어픽업

T : 사용함  
F : 사용안함

DEFAULT F

 |
| use\_virtual\_phone\_no | 

안심번호

T : 사용함  
F : 사용안함

DEFAULT F

 |
| max\_delivery\_limit  

_최소값: \[0\]_  
_최대값: \[12\]_

 | 

정기배송 횟수

0 : 제한없음  
2 : 2회  
3 : 3회  
4 : 4회  
6 : 6회  
10 : 10회  
12 : 12회

DEFAULT 0

 |
| items | 

주문상품목록

 |
| 

items 하위 요소 보기

**product\_code**  
**Required**  
상품코드

**product\_no**  
**Required**  
상품번호

**product\_name**  
**Required**  
상품명

**options** _Array_

options 하위 요소 보기

**name**  
옵션명

**value**  
옵션값

**option\_code**  
연동형 옵션코드

**value\_no**  
연동형 옵션값

**option\_id**  
**Required**  
상품옵션 아이디  
DEFAULT 000A

**quantity**  
**Required**  
주문 수량

**product\_price**  
**Required**  
상품 판매가

**option\_price**  
옵션 추가 가격

**shipping\_payment\_option**  
선/착불 구분  
C : 착불  
P : 선결제  
F : 무료

**category\_no**  
분류 번호

**product\_bundle**  
세트상품 여부  
T : 세트상품  
F : 세트상품 아님  
DEFAULT F

**bundle\_product\_components** _Array_

bundle\_product\_components 하위 요소 보기

**product\_code**  
상품코드

**product\_no**  
상품번호

**option\_id**  
상품옵션 아이디

**quantity**  
주문 수량













 |

Create a subscription

*   [Create a subscription](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a subscription [](#update-a-subscription)cafe24

PUT /api/v2/admin/subscription/shipments/{subscription\_id}

###### PUT

정기배송 정보를 수정할 수 있습니다.  
정기배송 신청번호는 필수 입력값입니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **subscription\_id**  
**Required** | 
정기배송 신청번호

 |
| receiver\_name  

_최대글자수 : \[100자\]_

 | 

수령자 명

 |
| receiver\_zipcode  

_글자수 최소: \[2자\]~최대: \[14자\]_

 | 

수령자 우편번호

 |
| receiver\_address1 | 

수령자 기본 주소

 |
| receiver\_address2 | 

수령자 상세 주소

 |
| receiver\_phone  

_최대글자수 : \[20자\]_

 | 

수령자 일반 전화

 |
| receiver\_cellphone  

_최대글자수 : \[20자\]_

 | 

수령자 휴대 전화

 |
| shipping\_message | 

배송 메세지

 |
| subscription\_state | 

정기배송 상태

U:이용중  
P:일시정지  
C:해지

 |

Update a subscription

*   [Update a subscription](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Subscription shipments items

정기배송 품목(Subscription shipments items)을 통해 정기배송 품목별 수정을 할 수 있습니다.

> Endpoints

```
PUT /api/v2/admin/subscription/shipments/{subscription_id}/items
```

#### \[더보기 상세 내용\]

### Subscription shipments items property list[](#subscription-shipments__items-property-list)

| **Attribute** | **Description** |
| --- | --- |
| subscription\_item\_id | 
정기배송 아이템 번호

 |
| subscription\_state | 

정기배송 상태

U:이용중  
B:일시정지(구매자신청)  
Q:일시정지(관리자신청)  
M:고객해지  
A:자동해지  
O:관리자해지

 |
| quantity | 

주문 수량

 |
| expected\_delivery\_date | 

배송예정일

 |
| subscription\_shipments\_cycle | 

배송주기

1W : 1주  
2W : 2주  
3W : 3주  
4W : 4주  
1M : 1개월  
2M : 2개월  
3M : 3개월  
4M : 4개월  
5M : 5개월  
6M : 6개월  
1Y : 1년

 |
| changed\_variant\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

변경된 옵션 품목코드

 |
| max\_delivery\_limit  

_최소값: \[0\]_  
_최대값: \[12\]_

 | 

정기배송 횟수

0 : 제한없음  
2 : 2회  
3 : 3회  
4 : 4회  
6 : 6회  
10 : 10회  
12 : 12회

 |

### Update product variants in subscription [](#update-product-variants-in-subscription)cafe24

PUT /api/v2/admin/subscription/shipments/{subscription\_id}/items

###### PUT

정기배송 품목별 수정을 할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 쓰기권한 (mall.write\_order)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **subscription\_id**  
**Required** | 
정기배송 신청번호

 |
| **subscription\_item\_id**  
**Required**  

_최소값: \[1\]_

 | 

정기배송 아이템 번호

 |
| subscription\_state | 

정기배송 상태

U:이용중  
Q:일시정지(관리자신청)  
O:관리자해지

 |
| quantity  

_최소값: \[1\]_

 | 

주문 수량

 |
| expected\_delivery\_date  

_날짜_

 | 

배송예정일

 |
| subscription\_shipments\_cycle | 

배송주기

1W : 1주  
2W : 2주  
3W : 3주  
4W : 4주  
1M : 1개월  
2M : 2개월  
3M : 3개월  
4M : 4개월  
5M : 5개월  
6M : 6개월  
1Y : 1년

 |
| changed\_variant\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

변경된 옵션 품목코드

 |
| max\_delivery\_limit  

_최소값: \[0\]_  
_최대값: \[12\]_

 | 

정기배송 횟수

0 : 제한없음  
2 : 2회  
3 : 3회  
4 : 4회  
6 : 6회  
10 : 10회  
12 : 12회

 |

Update product variants in subscription

*   [Update product variants in subscription](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Unpaidorders

> Endpoints

```
GET /api/v2/admin/unpaidorders
```

#### \[더보기 상세 내용\]

### Unpaidorders property list[](#unpaidorders-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| order\_id | 

주문번호

 |
| order\_item\_code | 

품주코드

 |
| order\_date | 

주문일

 |
| buyer\_name | 

주문자 이름

 |
| billing\_name | 

입금자명

 |
| bank\_code | 

은행코드

[bank\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/bank_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| bank\_name | 

은행명

 |
| unpaid\_amount | 

미입금 금액

 |
| accounts | 

계좌번호

 |
| payment\_method | 

결제수단

cash : 무통장  
icash : 가상계좌

 |
| settle\_type | 

결제타입

S: 기본결제  
E: 추가결제

 |
| payment\_no | 

결제번호

 |

### Retrieve unpaid orders [](#retrieve-unpaid-orders)cafe24

GET /api/v2/admin/unpaidorders

###### GET

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **주문 읽기권한 (mall.read\_order)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **start\_date**  
**Required**  

_날짜_

 | 

검색 시작일

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

 |
| payment\_method | 

결제수단

,(콤마)로 여러 건을 검색할 수 있다.

cash : 무통장  
icash : 가상계좌

 |
| settle\_type | 

결제타입

S: 기본결제  
E: 추가결제

 |
| limit  

_최소: \[1\]~최대: \[500\]_

 | 

조회결과 최대건수

DEFAULT 10

 |
| offset  

_최대값: \[15000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| order | 

정렬 순서

asc : 순차정렬  
desc : 역순 정렬

DEFAULT desc

 |

Retrieve unpaid orders

*   [Retrieve unpaid orders](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Customer

## Customergroups

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Customergroups.png)  
  
회원등급(CustomerGroups)은 쇼핑몰 회원을 등급별로 검색하여 관리할 수 있습니다.  
각 회원 등급 전체에게 메일, 적립금 지급, 선택한 회원의 등급 해제 및 변경을 할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/customergroups
GET /api/v2/admin/customergroups/count
GET /api/v2/admin/customergroups/{group_no}
```

#### \[더보기 상세 내용\]

### Customergroups property list[](#customergroups-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| group\_no | 

회원등급번호

 |
| group\_name | 

회원등급명

 |
| group\_description | 

회원 등급설명

 |
| group\_icon | 

회원등급 아이콘

 |
| benefits\_paymethod | 

혜택 결제조건

A : 모든 결제  
B : 현금 결제(무통장)  
C : 현금 결제 외 모든 결제

 |
| buy\_benefits | 

구매시 할인/적립 혜택

F : 혜택없음  
D : 구매금액 할인  
M : 적립금 지급  
P : 할인/적립 동시 적용

 |
| ship\_benefits | 

배송비 혜택

T : 배송비무료설정  
F : 배송비무료설정안함

 |
| product\_availability | 

상품별 할인 중복설정

P : 상품별 가격할인만 적용  
M : 회원등급별 가격할인만 적용  
A : 둘다적용

 |
| discount\_information | 

구매금액 할인설정

 |
| points\_information | 

적립금 지급설정

 |
| mobile\_discount\_information | 

모바일 추가 할인설정

 |
| mobile\_points\_information | 

모바일 추가 적립금설정

 |
| discount\_limit\_information | 

할인 제한설정

멀티쇼핑몰에서 등급별 할인 혜택 제한 사용 시 등급 별로 적용되는 할인 혜택 제한 설정 및 최대 할인 한도 정보.  
  
멀티쇼핑몰에서 등급별 할인 혜택 제한을 사용하지 않거나,  
buy\_benefits(구매 시 할인/적립 혜택)이 F(혜택없음) 또는 M(적립금 지급)일 경우 null로 반환  
  
discount\_limit\_type(할인 혜택 제한 설정)  
\- A : 제한없음  
\- B : 할인금액 제한  
\- C : 할인��수 제한  
discount\_amount\_limit(최대 할인금액 한도) : discount\_limit\_type이 B가 아닐 경우 null  
number\_of\_discount\_limit(최대 할인횟수 한도) : discount\_limit\_type이 C가 아닐 경우 null로 반환.

 |

### Retrieve a list of customer tiers [](#retrieve-a-list-of-customer-tiers)cafe24

GET /api/v2/admin/customergroups

###### GET

쇼핑몰에 추가한 회원등급 속성을 목록으로 조회합니다.  
회원등급번호, 회원등급명, 주매시 할인/적립 혜택 등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 읽기권한 (mall.read\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| group\_no | 

회원등급번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| group\_name  

_최대글자수 : \[20자\]_

 | 

회원등급명

,(콤마)로 여러 건을 검색할 수 있다.

 |

Retrieve a list of customer tiers

*   [Retrieve a list of customer tiers](#none)
*   [Retrieve customergroups with fields parameter](#none)
*   [Retrieve a specific customergroups with group\_no parameter](#none)
*   [Retrieve multiple customergroups](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of customer tiers [](#retrieve-a-count-of-customer-tiers)cafe24

GET /api/v2/admin/customergroups/count

###### GET

쇼핑몰에 추가한 회원등급의 수를 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 읽기권한 (mall.read\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| group\_no | 

회원등급번호

시스템이 회원등급에 부여한 번호.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| group\_name  

_최대글자수 : \[20자\]_

 | 

회원등급명

회원등급을 만들 당시 지정한 회원등급의 이름.

,(콤마)로 여러 건을 검색할 수 있다.

 |

Retrieve a count of customer tiers

*   [Retrieve a count of customer tiers](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a customer tier [](#retrieve-a-customer-tier)cafe24

GET /api/v2/admin/customergroups/{group\_no}

###### GET

회원등급번호를 이용하여 해당 회원등급의 속성을 조회합니다.  
회원등급명, 등급설명, 혜택 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 읽기권한 (mall.read\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **group\_no**  
**Required** | 

회원등급번호

시스템이 회원등급에 부여한 번호.

 |

Retrieve a customer tier

*   [Retrieve a customer tier](#none)
*   [Retrieve a customergroup with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Customergroups customers

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Customergroups%20customers.png)  
  
회원등급의 회원(Customergroups customers)은 특정 회원등급의 회원과 관련된 기능입니다.  
특정 회원을 특정 등급으로 변경할 수 있습니다.

> Endpoints

```
POST /api/v2/admin/customergroups/{group_no}/customers
```

#### \[더보기 상세 내용\]

### Customergroups customers property list[](#customergroups__customers-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| group\_no | 

회원등급번호

 |
| member\_id | 

회원아이디

 |
| fixed\_group | 

회원등급 고정 여부

특정 회원이 회원자동등급변경에 적용되지 않기 위한 등급 고정 여부.  
회원자동등급변경 기능을 사용하는 몰에서만 사용 가능하다.

T : 고정함  
F : 고정안함

 |

### Update a customer's customer tier [](#update-a-customer-s-customer-tier)cafe24

POST /api/v2/admin/customergroups/{group\_no}/customers

###### POST

특정 등급에 회원을 추가할 수 있습니다.  
회원등급 고정여부는 회원자동등급변경 기능을 사용하는 몰에서만 사용 가능합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 쓰기권한 (mall.write\_customer)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **200** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **group\_no**  
**Required** | 

회원등급번호

 |
| **member\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| fixed\_group | 

회원등급 고정 여부

특정 회원이 회원자동등급변경에 적용되지 않기 위한 등급 고정 여부  
회원자동등급변경 기능을 사용하는 몰에서만 사용 가능하다.

T : 고정함  
F : 고정안함

DEFAULT F

 |

Update a customer's customer tier

*   [Update a customer's customer tier](#none)
*   [Add a customer to a certain customer group](#none)
*   [Try adding a customer to a certain customer group without using member\_id](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Customergroups setting

회원등급에 대한 쇼핑몰 설정 정보를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/customergroups/setting
```

#### \[더보기 상세 내용\]

### Customergroups setting property list[](#customergroups-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| auto\_update | 

회원등급 자동변경 사용설정

T : 사용함  
F : 사용안함

 |
| use\_auto\_update | 

회원등급 자동변경 적용여부

T : 적용함(사용중)  
F : 적용안함(사용대기)

 |
| customer\_tier\_criteria | 

회원 등급 기준

purchase\_amount : 구매금액  
purchase\_count : 구매건수  
purchase\_amount\_and\_count : 구매금액과 구매건수  
purchase\_amount\_or\_count : 구매금액 또는 구매건수  
shopping\_index : 쇼핑지수

 |
| standard\_purchase\_amount | 

구매 금액 정의

total\_order\_amount : 총 주문 금액  
total\_paid\_amount : 총 결제 금액  
credit\_price : 총실결제금액 + 예치금

 |
| offline\_purchase\_amount | 

오프라인 구매금액 포함여부

T : 포함  
F : 미포함

 |
| standard\_purchase\_count | 

구매 건수 정의

order\_count : 주문 횟수  
product\_count : 상품(품목) 개수

 |
| offline\_purchase\_count | 

오프라인 구매건수 포함여부

T : 포함  
F : 미포함

 |
| auto\_update\_criteria | 

자동 변경 시 산정 주문 기준 설정

delivery\_complete : 배송완료 기준  
payment\_complete : 결제완료 기준

 |
| deduct\_cancellation\_refund | 

취소/환불 금액(건) 차감 여부

T : 취소/환불 금액(건) 차감  
F : 취소/환불 금액(건) 미차감

 |
| interval\_auto\_update | 

자동 변경 주기

1d : 매일  
3d : 3일  
1w : 1주  
1m : 1개월  
3m : 3개월  
6m : 6개월  
12m : 12개월

 |
| total\_period | 

등급 산정 누적 기간

now : 변경시점 직전까지  
1m : 최근 1개월  
3m : 최근 3개월  
6m : 최근 6개월  
12m : 최근 12개월  
24m : 최근 24개월  
36m : 최근 36개월

 |
| interval\_week | 

자동 변경일(매주)

0 : 일요일  
1 : 월요일  
2 : 화요일  
3 : 수요일  
4 : 목요일  
5 : 금요일  
6 : 토요일

 |
| interval\_month | 

자동 변경일(매월)

1 : 1일  
5 : 5일  
10 : 10일  
15 : 15일  
20 : 20일  
25 : 25일

 |
| auto\_update\_set\_date | 

회원등급 변경 시점

 |
| use\_discount\_limit | 

등급별 할인 제한 사용여부

T : 사용함  
F : 사용안함

 |
| discount\_limit\_reset\_period | 

할인 제한 초기화 주기

1d : 매일  
3d : 3일  
1w : 1주  
1m : 1개월

 |
| discount\_limit\_reset\_week | 

할인 제한 초기화 일자(매주)

0 : 일요일  
1 : 월요일  
2 : 화요일  
3 : 수요일  
4 : 목요일  
5 : 금요일  
6 : 토요일

 |
| discount\_limit\_reset\_date | 

할인 제한 초기화 일자(매월)

1 : 1일  
5 : 5일  
10 : 10일  
15 : 15일  
20 : 20일  
25 : 25일

 |
| discount\_limit\_begin\_date | 

할인 제한 시작 일자

 |
| discount\_limit\_end\_date | 

할인 제한 종료 일자

 |

### Retrieve customer tier settings [](#retrieve-customer-tier-settings)cafe24

GET /api/v2/admin/customergroups/setting

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 읽기권한 (mall.read\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve customer tier settings

*   [Retrieve customer tier settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Customers

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Customers.png)  
  
회원(Customers)은 쇼핑몰의 상품을 구매하는 고객들 중 쇼핑몰의 쿠폰, 적립금, 할인 등의 혜택을 받기 위해 가입한 고객들입니다.  
회원 관리를 위해 쇼핑몰 운영자는 회원을 특정 회원 등급으로 분류하거나 특별회원으로 지정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/customers
DELETE /api/v2/admin/customers/{member_id}
```

#### \[더보기 상세 내용\]

### Customers property list[](#customers-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| **member\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| group\_no | 

회원등급번호

해당 회원의 회원등급의 번호

 |
| member\_authentication | 

회원인증여부

회원 인증여부. 인증에 따라 회원은 4종류로 구분된다. 인증회원을 특별관리회원으로 설정할 경우 해당 회원은 가장 마지막에 설정한 특별관리회원으로 표시된다.

T : 인증  
F : 미인증  
B : 특별관리회원  
J : 14세미만회원

 |
| use\_blacklist | 

불량회원설정

불량회원 여부. 불량회원일 경우 불량회원 타입에 따라 상품구매 차단, 로그인 차단, 로그인과 상품구매 모두를 차단할 수 있음.

T : 설정함  
F : 설정안함

 |
| blacklist\_type | 

불량회원 차단설정

해당 회원의 불량회원 타입. 불량회원 타입에 따라 상품구매 차단, 로그인 차단, 로그인과 상품구매 모두를 차단할 수 있음.

P : 상품구매차단  
L : 로그인차단  
A : 로그인&상품구매 차단

 |
| authentication\_method | 

인증 수단

null : 인증안함  
i : 아이핀인증  
m : 휴대폰 본인인증  
e : 이메일인증  
d : 휴대폰 인증(중복 확인)  
a : 앱 인증(기타 인증)

 |
| sms | 

SMS 수신여부

SMS를 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함.

T : 수신  
F : 수신안함

 |
| news\_mail | 

뉴스메일 수신여부

이메일을 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함.

T : 수신  
F : 수신안함

 |
| solar\_calendar | 

양력여부

T : 양력  
F : 음력

 |
| total\_points | 

총 적립금

 |
| available\_points | 

가용 적립금

 |
| used\_points | 

사용 적립금

 |
| last\_login\_date | 

최근 접속일시

해당 회원의 최종 로그인 일시

 |
| gender | 

성별

해당 회원의 성별

M : 남자  
F : 여자

 |
| use\_mobile\_app | 

모바일앱 사용여부

T : 사용  
F : 사용안함

 |
| available\_credits | 

가용 예치금

 |
| created\_date | 

가입일

 |
| fixed\_group | 

회원등급 고정 여부

특정 회원이 회원자동등급변경에 적용되지 않기 위한 등급 고정 여부  
회원자동등급변경 기능을 사용하는 몰에서만 사용 가능하다.

T : 고정함  
F : 고정안함

 |

### Retrieve a list of customers [](#retrieve-a-list-of-customers)cafe24 youtube

GET /api/v2/admin/customers

###### GET

쇼핑몰에 가입한 특정 회원들을 검색합니다.  
검색할 회원의 휴대전화 또는 회원아이디가 검색 조건으로 지정되야합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 읽기권한 (mall.read\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| cellphone | 

휴대전화

검색할 쇼핑몰 회원의 휴대전화번호. 개인정보 보호를 위해 전체 휴대전화번호를 입력해야 한다. cellphone 또는 member\_id 중 하나는 반드시 검색 조건으로 지정되어야 한다.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

검색할 쇼핑몰 회원의 아이디. 개인정보 보호를 위해 전체 아이디를 입력해야 합니다.cellphone 또는 member\_id 중 하나는 반드시 검색 조건으로 지정되어야 한다.

,(콤마)로 여러 건을 검색할 수 있다.

 |

Retrieve a list of customers

*   [Retrieve a list of customers](#none)
*   [Retrieve customer using cell phone number](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete an account [](#delete-an-account)cafe24 youtube

DELETE /api/v2/admin/customers/{member\_id}

###### DELETE

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 쓰기권한 (mall.write\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| is\_point\_check | 

적립금보유회원 탈퇴 처리 여부

F : 탈퇴 안 함  
T : 탈퇴 처리

 |

Delete an account

*   [Delete an account](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Customers autoupdate

회원 별 회원등급 자동변경 정보(다음 예상 등급 등)를 API로 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/customers/{member_id}/autoupdate
```

#### \[더보기 상세 내용\]

### Customers autoupdate property list[](#customers__autoupdate-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| member\_id | 

회원아이디

 |
| next\_grade | 

다음 예상 등급

 |
| total\_purchase\_amount | 

등급 산정 기간 내 누적 사용 금액

 |
| total\_purchase\_count | 

등급 산정 기간 내 누적 사용 건수

 |
| required\_purchase\_amount | 

다음 등급까지 필요 금액

 |
| required\_purchase\_count | 

다음 등급까지 필요 건수

 |

### Retrieve customer tier auto-update details [](#retrieve-customer-tier-auto-update-details)cafe24

GET /api/v2/admin/customers/{member\_id}/autoupdate

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 읽기권한 (mall.read\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |

Retrieve customer tier auto-update details

*   [Retrieve customer tier auto-update details](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Customers memos

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Customers%20memos.png)  
  
회원 메모(Customers memos)는 특정 회원의 메모에 대한 회원의 하위 리소스입니다.  
회원 메모를 통해 특정 회원에 대하여 메모를 등록, 수정, 삭제 등을 할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/customers/{member_id}/memos/count
GET /api/v2/admin/customers/{member_id}/memos
GET /api/v2/admin/customers/{member_id}/memos/{memo_no}
POST /api/v2/admin/customers/{member_id}/memos
PUT /api/v2/admin/customers/{member_id}/memos/{memo_no}
DELETE /api/v2/admin/customers/{member_id}/memos/{memo_no}
```

#### \[더보기 상세 내용\]

### Customers memos property list[](#customers__memos-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| memo\_no | 

메모 번호

시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| author\_id | 

작성자 아이디

메모를 작성한 관리자의 아이디 정보.

 |
| memo | 

메모 내용

메모의 내용. HTML을 사용하여 등록할 수 있다.

 |
| important\_flag | 

중요 메모 여부

중요 메모의 구분여부.

T : 중요 메모  
F : 일반 메모

 |
| created\_date | 

생성일

메모를 작성한 시간.

 |

### Retrieve a count of customer memos [](#retrieve-a-count-of-customer-memos)cafe24

GET /api/v2/admin/customers/{member\_id}/memos/count

###### GET

특정 회원의 메모 개수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 읽기권한 (mall.read\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **member\_id**  
**Required** | 

회원아이디

 |

Retrieve a count of customer memos

*   [Retrieve a count of customer memos](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a list of customer memos [](#retrieve-a-list-of-customer-memos)cafe24

GET /api/v2/admin/customers/{member\_id}/memos

###### GET

특정 회원에 대한 메모 목록을 조회할 수 있습니다.  
작성자 아이디, 메모 내용, 중요 메모 여부 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 읽기권한 (mall.read\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required** | 

회원아이디

 |
| start\_date  

_날짜_

 | 

검색 시작일

 |
| end\_date  

_날짜_

 | 

검색 종료일

 |
| important\_flag | 

중요 메모 여부

T : 중요 메모  
F : 일반 메모

 |
| memo | 

메모

 |
| offset  

_최대값: \[10000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve a list of customer memos

*   [Retrieve a list of customer memos](#none)
*   [Retrieve memos with fields parameter](#none)
*   [Retrieve memos using paging](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a customer memo [](#retrieve-a-customer-memo)cafe24

GET /api/v2/admin/customers/{member\_id}/memos/{memo\_no}

###### GET

특정 회원의 메모 1개를 조회할 수 있습니다.  
메모의 작성자 아이디, 메모 내용 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 읽기권한 (mall.read\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **memo\_no**  
**Required** | 

메모 번호

시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| **member\_id**  
**Required** | 

회원아이디

 |

Retrieve a customer memo

*   [Retrieve a customer memo](#none)
*   [Retrieve a customer memo with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a customer memo [](#create-a-customer-memo)cafe24

POST /api/v2/admin/customers/{member\_id}/memos

###### POST

특정 회원에 메모를 등록할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 쓰기권한 (mall.write\_customer)** |
| 호출건수 제한 | **30** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required** | 

회원아이디

 |
| **author\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

작성자 아이디

메모를 작성한 관리자의 아이디 정보.

 |
| **memo**  
**Required** | 

메모

메모의 내용. HTML을 사용하여 등록할 수 있다.

 |
| important\_flag | 

중요 메모 여부

중요 메모의 구분여부.

T : 중요 메모  
F : 일반 메모

DEFAULT F

 |

Create a customer memo

*   [Create a customer memo](#none)
*   [Post a memo of a customer using only author\_id and memo fields](#none)
*   [Try posting a memo of a customer without using author\_id field](#none)
*   [Try posting a memo of a customer without using memo field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a customer memo [](#update-a-customer-memo)cafe24

PUT /api/v2/admin/customers/{member\_id}/memos/{memo\_no}

###### PUT

특정 회원에 등록된 메모를 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 쓰기권한 (mall.write\_customer)** |
| 호출건수 제한 | **30** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| shop\_no | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **memo\_no**  
**Required** | 

메모 번호

시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| **member\_id**  
**Required** | 

회원아이디

 |
| **author\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

작성자 아이디

메모를 작성한 관리자의 아이디 정보.

 |
| memo | 

메모

메모의 내용. HTML을 사용하여 등록할 수 있다.

 |
| important\_flag | 

중요 메모 여부

중요 메모의 구분여부.

T : 중요 메모  
F : 일반 메모

 |

Update a customer memo

*   [Update a customer memo](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a customer memo [](#delete-a-customer-memo)cafe24

DELETE /api/v2/admin/customers/{member\_id}/memos/{memo\_no}

###### DELETE

특정 회원에 등록된 메모를 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 쓰기권한 (mall.write\_customer)** |
| 호출건수 제한 | **30** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **memo\_no**  
**Required** | 

메모 번호

시스템에서 부여한 상품 메모의 고유한 번호. 상품 메모 번호는 쇼핑몰 내에서 중복되지 않는다.

 |
| **member\_id**  
**Required** | 

회원아이디

 |

Delete a customer memo

*   [Delete a customer memo](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Customers paymentinformation

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Customers%20paymentinformation.png)  
  
회원의 결제수단정보(Customers paymentinformation)는 회원이 결제한 결제수단에 대해 목록조회, 삭제가 가능합니다.

> Endpoints

```
GET /api/v2/admin/customers/{member_id}/paymentinformation
DELETE /api/v2/admin/customers/{member_id}/paymentinformation
DELETE /api/v2/admin/customers/{member_id}/paymentinformation/{payment_method_id}
```

#### \[더보기 상세 내용\]

### Customers paymentinformation property list[](#customers__paymentinformation-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| payment\_method | 

결제수단명

 |
| payment\_gateway | 

PG 이름

 |
| created\_date | 

생성일

 |
| payment\_proiority | 

결제 우선순위

 |
| payment\_method\_id | 

정기배송 결제수단 번호

 |

### Retrieve a customer's list of payment methods [](#retrieve-a-customer-s-list-of-payment-methods)cafe24

GET /api/v2/admin/customers/{member\_id}/paymentinformation

###### GET

특정 회원이 사용한 결제수단의 내역을 목록으로 조회할 수 있습니다.  
결제수단명, PG이름 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 읽기권한 (mall.read\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |

Retrieve a customer's list of payment methods

*   [Retrieve a customer's list of payment methods](#none)
*   [Retrieve paymentinformation with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete customer's payment information [](#delete-customer-s-payment-information)cafe24

DELETE /api/v2/admin/customers/{member\_id}/paymentinformation

###### DELETE

특정 회원이 사용한 결제수단의 내역을 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 쓰기권한 (mall.write\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |

Delete customer's payment information

*   [Delete customer's payment information](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete customer's payment information by payment method ID [](#delete-customer-s-payment-information-by-payment-method-id)cafe24

DELETE /api/v2/admin/customers/{member\_id}/paymentinformation/{payment\_method\_id}

###### DELETE

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 쓰기권한 (mall.write\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| **payment\_method\_id**  
**Required**  

_주문번호_

 | 

정기배송 결제수단 번호

 |

Delete customer's payment information by payment method ID

*   [Delete customer's payment information by payment method ID](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Customers plusapp

쇼핑몰 회원의 플러스앱 설치 정보를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/customers/{member_id}/plusapp
```

#### \[더보기 상세 내용\]

### Customers plusapp property list[](#customers__plusapp-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| os\_type | 

OS 타입

 |
| install\_date | 

설치일

 |
| auto\_login\_flag | 

자동로그인 설정 여부

 |
| use\_push\_flag | 

알림 수신 여부

 |

### Retrieve app installation information [](#retrieve-app-installation-information)cafe24

GET /api/v2/admin/customers/{member\_id}/plusapp

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 읽기권한 (mall.read\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required** | 

회원아이디

 |

Retrieve app installation information

*   [Retrieve app installation information](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Customers social

회원의 SNS(Customers social)는 특정 회원에게 연동된 SNS 계정의 정보를 조회할 수 있는 기능입니다.

> Endpoints

```
GET /api/v2/admin/customers/{member_id}/social
```

#### \[더보기 상세 내용\]

### Customers social property list[](#customers__social-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| member\_id | 

회원아이디

 |
| social\_name | 

연동 된 SNS명

 |
| social\_member\_code | 

연동 된 SNS 제공코드

 |
| linked\_date | 

연동 날짜

 |

### Retrieve a customer's social account [](#retrieve-a-customer-s-social-account)cafe24

GET /api/v2/admin/customers/{member\_id}/social

###### GET

특정 회원에게 연동된 SNS 계정의 정보를 목록으로 조회할 수 있습니다.  
연동 된 SNS명과 연동 날짜 등을 조회할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 읽기권한 (mall.read\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required** | 

회원아이디

 |

Retrieve a customer's social account

*   [Retrieve a customer's social account](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Customers properties

회원가입항목 설정을 관리 할 수 있습니다. 기본회원가입항목, 상세회원가입항목 사용여부 확인이 가능하며 회원가입 시 필요항목 및 추가항목(생년월일, 결혼기념일, 배우자 생일 등) 설정을 조회하거나 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/customers/properties
PUT /api/v2/admin/customers/properties
```

#### \[더보기 상세 내용\]

### Customers properties property list[](#customers-properties-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| type | 

회원가입항목 유형

 |
| properties | 

항목

 |

### View account signup fields [](#view-account-signup-fields)cafe24

GET /api/v2/admin/customers/properties

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 읽기권한 (mall.read\_customer)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| type | 

회원가입항목 유형

join:회원가입 항목  
edit:회원정보 수정 항목

DEFAULT join

 |

View account signup fields

*   [View account signup fields](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Edit account signup fields [](#edit-account-signup-fields)cafe24

PUT /api/v2/admin/customers/properties

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **회원 쓰기권한 (mall.write\_customer)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **type**  
**Required** | 

회원가입항목 유형

join:회원가입 항목  
edit:회원정보 수정 항목

 |
| properties | 

항목

 |
| 

properties 하위 요소 보기

**key**  
항목키

**use**  
일반 회원가입 사용여부  
T:사용  
F:사용안함

**required**  
필수입력여부  
T:필수  
F:선택







 |

Edit account signup fields

*   [Edit account signup fields](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Community

## Boards

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Boards.png)  
  
게시판(Boards)은 상품리뷰나 상품문의 등 고객의 반응이 글로 게시되는 공간입니다.  
게시판 리소스에서는 현재 쇼핑몰에 있는 게시판의 목록을 확인할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/boards
GET /api/v2/admin/boards/{board_no}
PUT /api/v2/admin/boards/{board_no}
```

#### \[더보기 상세 내용\]

### Boards property list[](#boards-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| board\_no | 

게시판 번호

 |
| board\_type | 

게시판 분류

1 : 운영  
2 : 일반  
3 : 자료실  
4 : 기타  
5 : 상품  
6 : 갤러리  
7 : 1:1상담  
11 : 한줄메모

 |
| board\_name | 

게시판 이름

 |
| use\_additional\_board | 

게시판 추가여부

T : 추가게시판  
F : 기본게시판

 |
| use\_board | 

게시판 사용여부

T : 사용함  
F : 사용안함

 |
| use\_display | 

표시여부

T : 표시함  
F : 표시안함

 |
| use\_top\_image | 

화면 상단 이미지 사용여부

T : 사용함  
F : 사용안함

 |
| top\_image\_url | 

화면 상단 이미지 경로

 |
| use\_report | 

게시글 신고기능 사용 여부

T : 사용함  
F : 사용안함

 |
| use\_writer\_block | 

작성자 차단 기능 사용 여부

T : 사용함  
F : 사용안함

 |
| display\_order | 

정렬 순서

 |
| attached\_file | 

파일 첨부

T : 사용함  
F : 사용안함

 |
| attached\_file\_size\_limit | 

첨부파일용량제한 (Byte)

 |
| article\_display\_type | 

게시물 표시

A : 전체 게시물 표시  
T : 첨부 파일이 있는 게시물만 표시  
F : 첨부 파일이 없는 게시물만 표시

 |
| image\_display | 

이미지 표시

T : 사용함  
F : 사용안함

 |
| image\_resize | 

리사이징할 이미지 폭 (px)

 |
| use\_category | 

카테고리 기능 사용여부

T : 사용함  
F : 사용안함

 |
| categories | 

카테고리 정보

 |
| secret\_only | 

비밀글만 등록 가능여부

T: 비밀글만 등록  
F: 공개글과 비밀글을 선택하여 등록

 |
| admin\_confirm | 

관리자 확인 기능 사용여부

T: 사용함  
F: 사용안함

 |
| comment\_author\_display | 

댓글 작성자 표시 설정

N : 이름  
U : 별명(별명기입전 이름으로 노출)  
I : 별명(별명기입전 아이디로 노출)

 |
| comment\_author\_protection | 

댓글 작성자 보호 설정

 |
| spam\_auto\_prevention | 

스팸 자동생성방지 기능

 |
| reply\_feature | 

답변기능

T : 사용함  
F : 사용안함

 |
| write\_permission | 

쓰기 권한

A : 관리자  
V : 회원이상노출  
I : 회원이상 비노출  
N : 비회원이상  
G : 접근회원그룹설정

 |
| write\_member\_group\_no | 

쓰기 권한 접근회원그룹 번호

 |
| write\_permission\_extra | 

쓰기권한 부가설정

 |
| reply\_permission | 

답변쓰기 권한

A : 관리자  
M : 회원이상  
N : 비회원이상  
G : 접근회원그룹설정

 |
| reply\_member\_group\_no | 

답변쓰기 권한 접근회원그룹 번호

 |
| author\_display | 

작성자 표시 설정

N : 이름  
U : 별명(별명기입전 이름으로 노출)  
I : 별명(별명기입전 아이디로 노출)

 |
| author\_protection | 

작성자 보호 설정

 |
| board\_guide | 

게시판 안내글

 |
| admin\_title\_fixed | 

게시글 제목을 관리자가 설정한 값으로 고정

 |
| admin\_reply\_fixed | 

답변글 제목을 관리자가 설정한 값으로 고정할지 여부

 |
| input\_form | 

게시글 입력 양식 설정 여부

 |
| page\_size | 

페이지당 목록 수

 |
| product\_page\_size | 

상품 상세 정보 → 페이지당 목록 수

 |
| page\_display\_count | 

페이지 표시 수

 |
| use\_comment | 

댓글 기능 사용 여부

T : 사용함  
F : 사용안함

 |

### Retrieve a list of boards [](#retrieve-a-list-of-boards)cafe24 youtube

GET /api/v2/admin/boards

###### GET

현재 쇼핑몰에 있는 게시판을 목록으로 조회할 수 있습니다.  
게시판 번호를 조회하여 게시물 조회나 댓글 조회시 사용할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 읽기권한 (mall.read\_community)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve a list of boards

*   [Retrieve a list of boards](#none)
*   [Retrieve boards with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve the board settings [](#retrieve-the-board-settings)cafe24 youtube

GET /api/v2/admin/boards/{board\_no}

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 읽기권한 (mall.read\_community)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **board\_no**  
**Required** | 
게시판 번호

 |

Retrieve the board settings

*   [Retrieve the board settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update the board settings [](#update-the-board-settings)cafe24 youtube

PUT /api/v2/admin/boards/{board\_no}

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 쓰기권한 (mall.write\_community)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **board\_no**  
**Required** | 

게시판 번호

 |
| use\_board | 

게시판 사용여부

T : 사용함  
F : 사용안함

 |
| use\_display | 

표시여부

T : 표시함  
F : 표시안함

 |
| use\_top\_image | 

화면 상단 이미지 사용여부

T : 사용함  
F : 사용안함

 |
| top\_image\_url  

_URL_

 | 

화면 상단 이미지 경로

 |
| attached\_file | 

파일 첨부

T : 사용함  
F : 사용안함

 |
| attached\_file\_size\_limit  

_최소값: \[1\]_  
_최대값: \[10485760\]_

 | 

첨부파일용량제한 (Byte)

 |
| use\_category | 

카테고리 기능 사용여부

T : 사용함  
F : 사용안함

 |
| categories | 

카테고리 정보

 |
| secret\_only | 

비밀글만 등록 가능여부

T: 비밀글만 등록  
F: 공개글과 비밀글을 선택하여 등록

 |
| admin\_confirm | 

관리자 확인 기능 사용여부

T: 사용함  
F: 사용안함

 |
| comment\_author\_display | 

댓글 작성자 표시 설정

N : 이름  
U : 별명(별명기입전 이름으로 노출)  
I : 별명(별명기입전 아이디로 노출)

 |
| comment\_author\_protection | 

댓글 작성자 보호 설정

 |
| 

comment\_author\_protection 하위 요소 보기

**is\_use**  
보호 설정 사용 여부  
T : 사용함  
F : 사용안함

**author\_name\_type**  
보호 설정  
count : 일부 글자 수만 노출  
content : 대체 문구로 노출

**partial\_character\_display**  
작성자 보호 설정 시 노출할 일부 글자수

**alternative\_text\_display**  
작성자 보호 설정 시 대체 문구







 |
| spam\_auto\_prevention | 

스팸 자동생성방지 기능

 |
| 

spam\_auto\_prevention 하위 요소 보기

**apply\_scope**  
적용범위  
post\_actions : 글쓰기/수정/답변  
comment : 댓글

**member\_scope**  
대상회원  
A : 전체  
M : 회원  
N : 비회원







 |
| reply\_feature | 

답변기능

T : 사용함  
F : 사용안함

 |
| write\_permission | 

쓰기 권한

A : 관리자  
V : 회원이상노출  
I : 회원이상 비노출  
N : 비회원이상  
G : 접근회원그룹설정

 |
| write\_member\_group\_no | 

쓰기 권한 접근회원그룹 번호

 |
| write\_permission\_extra | 

쓰기권한 부가설정

 |
| 

write\_permission\_extra 하위 요소 보기

**is\_member\_buy**  
회원 구매내역 체크 여부  
T : 체크함  
F : 체크안함

**member\_write\_after**  
회원 쓰기권한 적용 시점  
place\_date : 결제완료 이후  
shipbegin\_date : 배송중 이후  
shipend\_date : 배송완료 이후

**use\_member\_write\_period**  
회원 쓰기권한 작성 기간 설정 여부  
T : 사용함  
F : 사용안함

**member\_write\_period**  
회원 쓰기권한 작성 기간

**is\_guest\_buy**  
비회원 구매내역 체크 여부  
T : 체크함  
F : 체크안함

**guest\_write\_after**  
비회원 쓰기권한 적용 시점  
order\_date : 주문완료 이후  
place\_date : 결제완료 이후  
shipbegin\_date : 배송중 이후  
shipend\_date : 배송완료 이후

**use\_guest\_write\_period**  
비회원 쓰기권한 작성 기간 설정 여부  
T : 사용함  
F : 사용안함

**guest\_write\_period**  
비회원 쓰기권한 작성 기간

**product\_info\_option**  
상품정보 등록 옵션  
T : 글 작성 시 상품 정보 선택 허용  
F : 글 작성 시 상품 정보 선택 불가

**post\_length\_limit**  
글자수 제한여부  
T : 제한함  
F : 제한없음

**post\_min\_length**  
최소 글자수

**post\_editable**  
글 수정/삭제 가능여부  
T : 가능  
F : 불가







 |
| reply\_permission | 

답변쓰기 권한

A : 관리자  
M : 회원이상  
N : 비회원이상  
G : 접근회원그룹설정

 |
| reply\_member\_group\_no | 

답변쓰기 권한 접근회원그룹 번호

 |
| author\_display | 

작성자 표시 설정

N : 이름  
U : 별명(별명기입전 이름으로 노출)  
I : 별명(별명기입전 아이디로 노출)

 |
| author\_protection | 

작성자 보호 설정

 |
| 

author\_protection 하위 요소 보기

**is\_use**  
보호 설정 사용 여부  
T : 사용함  
F : 사용안함

**author\_name\_type**  
보호 설정  
count : 일부 글자 수만 노출  
content : 대체 문구로 노출

**partial\_character\_display**  
작성자 보호 설정 시 노출할 일부 글자수

**alternative\_text\_display**  
작성자 보호 설정 시 대체 문구







 |
| board\_guide | 

게시판 안내글

 |
| admin\_title\_fixed | 

게시글 제목을 관리자가 설정한 값으로 고정

 |
| 

admin\_title\_fixed 하위 요소 보기

**is\_use**  
**Required**  
게시글 제목을 관리자가 설정한 고정값으로 사용할지 여부  
T : 사용함  
F : 사용안함

**admin\_title\_list**  
**Required**  
관리자 지정 제목 설정

**staff\_skip\_post\_title**  
**Required**  
운영자가 게시글을 작성할 때 제목 고정 기능 미사용  
T : 사용함  
F : 사용안함







 |
| admin\_reply\_fixed | 

답변글 제목을 관리자가 설정한 값으로 고정할지 여부

 |
| 

admin\_reply\_fixed 하위 요소 보기

**is\_use**  
**Required**  
답변글 제목을 관리자 설정값으로 고정할지 여부  
T : 사용함  
F : 사용안함

**admin\_reply\_list**  
**Required**  
관리자 지정 답변글 설정

**staff\_skip\_reply\_title**  
**Required**  
운영자가 게시글을 작성할 때 고정 제목 미사용  
T : 사용함  
F : 사용안함







 |
| input\_form | 

게시글 입력 양식 설정 여부

 |
| 

input\_form 하위 요소 보기

**is\_use**  
**Required**  
게시글 입력 양식 사용 여부  
T : 사용함  
F : 사용안함

**input\_form\_title**  
**Required**  
게시글 입력 양식 제목

**enable\_input\_form\_title**  
**Required**  
게시글 입력 양식 제목 노출 여부  
T : 사용함  
F : 사용안함







 |
| page\_size  

_최소값: \[1\]_  
_최대값: \[99\]_

 | 

페이지당 목록 수

 |
| product\_page\_size  

_최소값: \[5\]_  
_최대값: \[999\]_

 | 

상품 상세 정보 → 페이지당 목록 수

 |
| page\_display\_count  

_최소값: \[1\]_  
_최대값: \[99\]_

 | 

페이지 표시 수

 |
| use\_comment | 

댓글 기능 사용 여부

T : 사용함  
F : 사용안함

 |
| board\_name  

_최소글자수 : \[1자\]_  
_최대글자수 : \[50자\]_

 | 

게시판 이름

 |
| board\_type | 

게시판 분류

1 : 운영  
2 : 일반  
5 : 상품

 |
| article\_display\_type | 

게시물 표시

A : 전체 게시물 표시  
T : 첨부 파일이 있는 게시물만 표시  
F : 첨부 파일이 없는 게시물만 표시

 |

Update the board settings

*   [Update the board settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Boards articles

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Boards%20articles.png)  
  
게시물(Boards articles)은 게시판에 게시되는 게시물을 관리하기 위한 리소스입니다.  
특정 게시판의 게시물을 조회하거나 게시물을 생성하거나 수정, 삭제할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/boards/{board_no}/articles
POST /api/v2/admin/boards/{board_no}/articles
PUT /api/v2/admin/boards/{board_no}/articles/{article_no}
DELETE /api/v2/admin/boards/{board_no}/articles/{article_no}
```

#### \[더보기 상세 내용\]

### Boards articles property list[](#boards__articles-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| article\_no  

_최대값: \[2147483647\]_

 | 

게시물 번호

 |
| parent\_article\_no | 

부모 게시물 번호

 |
| **board\_no**  
**Required** | 

게시판 번호

 |
| product\_no | 

상품번호

 |
| category\_no | 

분류 번호

 |
| board\_category\_no | 

게시판 카테고리 번호

 |
| reply\_sequence | 

답변 게시물 순서

 |
| reply\_depth | 

답변 차수

 |
| created\_date  

_날짜_

 | 

생성일

 |
| writer | 

작성자명

 |
| writer\_email  

_이메일_

 | 

작성자 이메일

 |
| member\_id | 

회원아이디

 |
| title | 

제목

 |
| content | 

내용

 |
| supplier\_id  

_형식 : \[a-z0-9\]_  
_글자수 최소: \[4자\]~최대: \[16자\]_

 | 

공급사 아이디

 |
| client\_ip  

_IP_

 | 

작성자 IP

 |
| nick\_name | 

별명

 |
| rating  

_최소: \[1\]~최대: \[5\]_

 | 

평점

 |
| sales\_channel  

_최대글자수 : \[20자\]_

 | 

매체사

 |
| reply\_mail | 

1:1 게시판 문의내용에 대한 답변 메일 여부

Y : 사용함  
N : 사용안함

 |
| display | 

게시 여부

T : 게시함  
F : 게시안함

 |
| secret | 

비밀글 여부

T : 사용함  
F : 사용안함

 |
| notice | 

공지 여부

T : 사용함  
F : 사용안함

 |
| fixed | 

고정글 여부

T : 사용함  
F : 사용안함

 |
| deleted | 

삭제 구분

T: 삭제  
F: 비삭제  
B: 등록전

 |
| input\_channel | 

게시물 작성 경로

P : PC  
M : 모바일

 |
| order\_id | 

주문번호

 |
| attach\_file\_urls | 

첨부 파일 상세

 |
| hit | 

조회수

 |
| reply | 

1:1 게시판 문의내용에 대한 답변여부

T : 사용함  
F : 사용안함

 |
| reply\_user\_id | 

처리중 또는 답변완료 한 운영자 아이디

 |
| reply\_status | 

답변 처리 상태

N : 답변전  
P : 처리중  
C : 처리완료

 |
| naverpay\_review\_id | 

네이버페이 리뷰 아이디

 |
| display\_time | 

노출시간 사용여부

 |
| display\_time\_start\_hour | 

노출시간 시작 시각

 |
| display\_time\_end\_hour | 

노출시간 종료 시각

 |
| attached\_file\_detail | 

첨부 파일 상세

 |
| attached\_file\_urls | 

첨부 파일 상세

 |

### Retrieve a list of posts for a board [](#retrieve-a-list-of-posts-for-a-board)cafe24

GET /api/v2/admin/boards/{board\_no}/articles

###### GET

특정 게시판의 게시물 목록을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 읽기권한 (mall.read\_community)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **board\_no**  
**Required** | 

게시판 번호

 |
| board\_category\_no | 

게시판 카테고리 번호

 |
| start\_date  

_날짜_

 | 

검색 시작일(작성일)

검색을 시작할 기준일 또는 작성일

 |
| end\_date  

_날짜_

 | 

검색 종료일

검색을 종료할 기준일  
검색 시작일과 같이 사용해야함. 검색기간은 한 호출에 1년 이상 검색 불가.

 |
| input\_channel | 

쇼핑몰 구분

P : PC  
M : 모바일

 |
| search | 

검색 영역

subject : 제목  
content : 내용  
writer\_name : 작성자  
product : 상품명  
member\_id : 회원 아이디

 |
| keyword | 

검색어

 |
| reply\_status | 

답변상태

N : 답변 전  
P : 처리중  
C : 답변 완료

 |
| comment | 

댓글여부

T : 있음  
F : 없음

 |
| attached\_file | 

첨부파일 여부

T : 있음  
F : 없음

 |
| article\_type | 

게시물 유형

,(콤마)로 여러 건을 검색할 수 있다.

all : 전체  
normal : 일반글  
notice : 공지글  
fixed : 고정글

 |
| product\_no | 

상품번호

 |
| has\_product | 

상품정보 포함 여부

T : 있음  
F : 없음

 |
| is\_notice | 

공지 여부

T : 있음  
F : 없음

 |
| is\_display | 

게시 여부

T : 있음  
F : 없음

 |
| supplier\_id  

_형식 : \[a-z0-9\]_  
_글자수 최소: \[4자\]~최대: \[16자\]_

 | 

공급사 아이디

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve a list of posts for a board

*   [Retrieve a list of posts for a board](#none)
*   [Retrieve articles with fields parameter](#none)
*   [Retrieve articles using paging](#none)
*   [Retrieve a specific articles with product\_no parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a board post [](#create-a-board-post)cafe24 youtube

POST /api/v2/admin/boards/{board\_no}/articles

###### POST

특정 게시판에 게시물을 등록할 수 있습니다.  
해당 게시판이 상품 게시판일 경우 평점과 같은 정보도 등록할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 쓰기권한 (mall.write\_community)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **board\_no**  
**Required** | 

게시판 번호

 |
| **writer**  
**Required**  

_최대글자수 : \[100자\]_

 | 

작성자명

 |
| **title**  
**Required**  

_최대글자수 : \[256자\]_

 | 

제목

 |
| **content**  
**Required** | 

내용

 |
| **client\_ip**  
**Required**  

_IP_

 | 

작성자 IP

 |
| reply\_article\_no | 

답변 게시물 번호

게시물에 답변을 추가하고자 할 경우 게시물의 번호를 입력한다.

 |
| created\_date  

_날짜_

 | 

생성일

 |
| writer\_email  

_이메일_

 | 

작성자 이메일

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

member\_id가 mall\_id인 경우: 작성자는 shop\_name이 반환됩니다.  
member\_id를 입력하지 않거나, 회원 ID인 경우: 작성자는 writer 값이 반환됩니다.

 |
| notice | 

공지 여부

T : 사용함  
F : 사용안함

DEFAULT F

 |
| fixed | 

고정글 여부

T : 사용함  
F : 사용안함

DEFAULT F

 |
| deleted | 

삭제 구분

T: 삭제  
F: 비삭제  
B: 등록전

DEFAULT F

 |
| reply | 

1:1 게시판 문의내용에 대한 답변여부

T : 사용함  
F : 사용안함

DEFAULT F

 |
| rating  

_최소: \[1\]~최대: \[5\]_

 | 

평점

 |
| sales\_channel  

_최대글자수 : \[20자\]_

 | 

매체사

 |
| secret | 

비밀글 여부

T : 사용함  
F : 사용안함

DEFAULT F

 |
| password | 

게시글 비밀번호

 |
| reply\_mail | 

1:1 게시판 문의내용에 대한 답변 메일 여부

Y : 사용함  
N : 사용안함

DEFAULT N

 |
| board\_category\_no | 

게시판 카테고리 번호

 |
| nick\_name  

_최대글자수 : \[50자\]_

 | 

별명

 |
| input\_channel | 

게시물 작성 경로

P : PC  
M : 모바일

DEFAULT P

 |
| reply\_user\_id | 

처리중 또는 답변완료 한 운영자 아이디

 |
| reply\_status | 

답변 처리 상태

N : 답변전  
P : 처리중  
C : 처리완료

 |
| product\_no  

_최대값: \[2147483647\]_

 | 

상품번호

 |
| category\_no | 

분류 번호

 |
| order\_id  

_주문번호_

 | 

주문번호

 |
| naverpay\_review\_id | 

네이버페이 리뷰 아이디

 |
| attach\_file\_urls | 

첨부 파일 상세

 |
| 

attach\_file\_urls 하위 요소 보기

**name**  
파일명

**url**  
파일 URL







 |

Create a board post

*   [Create a board post](#none)
*   [Post an article of a board using only writer, title, content, and client\_ip fields](#none)
*   [Try posting an article of a board without using writer field](#none)
*   [Try posting an article of a board without using title field](#none)
*   [Try posting an article of a board without using content field](#none)
*   [Try posting an article of a board without using client\_ip field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a board post [](#update-a-board-post)cafe24

PUT /api/v2/admin/boards/{board\_no}/articles/{article\_no}

###### PUT

특정 게시판의 게시물을 수정할 수 있습니다.  
게시물의 제목, 내용과 평점, 노출 시간 등의 정보를 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 쓰기권한 (mall.write\_community)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **board\_no**  
**Required** | 

게시판 번호

 |
| **article\_no**  
**Required** | 

게시물 번호

 |
| title  

_최대글자수 : \[256자\]_

 | 

제목

 |
| content | 

내용

 |
| rating  

_최소: \[1\]~최대: \[5\]_

 | 

평점

 |
| sales\_channel  

_최대글자수 : \[20자\]_

 | 

매체사

 |
| board\_category\_no | 

게시판 카테고리 번호

 |
| display | 

게시 여부

T : 게시함  
F : 게시안함

 |
| notice | 

공지 여부

T : 사용함  
F : 사용안함

 |
| fixed | 

고정글 여부

T : 사용함  
F : 사용안함

 |
| display\_time\_start\_hour | 

노출시간 시작 시각

 |
| display\_time\_end\_hour | 

노출시간 종료 시각

 |
| attach\_file\_url1  

_URL_

 | 

파일 URL

 |
| attach\_file\_url2  

_URL_

 | 

파일 URL

 |
| attach\_file\_url3  

_URL_

 | 

파일 URL

 |
| attach\_file\_url4  

_URL_

 | 

파일 URL

 |
| attach\_file\_url5  

_URL_

 | 

파일 URL

 |

Update a board post

*   [Update a board post](#none)
*   [Edit a title and contents of the article](#none)
*   [Update a display status of the article](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a board post [](#delete-a-board-post)cafe24

DELETE /api/v2/admin/boards/{board\_no}/articles/{article\_no}

###### DELETE

특정 게시판에 있는 게시물 하나를 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 쓰기권한 (mall.write\_community)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **board\_no**  
**Required** | 

게시판 번호

 |
| **article\_no**  
**Required**  

_최대값: \[2147483647\]_

 | 

게시물 번호

 |

Delete a board post

*   [Delete a board post](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Boards articles comments

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Boards%20articles%20comments.png)  
  
댓글(Comments)은 게시물에 쇼핑몰 고객이나 관리자가 추가한 의견입니다.  
해당 리소스를 통해 특정 게시물에 달린 댓글을 추가/삭제하거나 조회할 수 있습니다

> Endpoints

```
GET /api/v2/admin/boards/{board_no}/articles/{article_no}/comments
POST /api/v2/admin/boards/{board_no}/articles/{article_no}/comments
DELETE /api/v2/admin/boards/{board_no}/articles/{article_no}/comments/{comment_no}
```

#### \[더보기 상세 내용\]

### Boards articles comments property list[](#boards__articles__comments-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| board\_no | 

게시판 번호

 |
| article\_no | 

게시물 번호

 |
| comment\_no | 

댓글 번호

 |
| content | 

댓글 내용

 |
| writer  

_최대글자수 : \[100자\]_

 | 

작성자명

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| created\_date  

_날짜_

 | 

생성일

 |
| client\_ip  

_IP_

 | 

작성자 IP

 |
| rating  

_최소: \[1\]~최대: \[5\]_

 | 

댓글 평점

 |
| secret | 

비밀글 여부

T : 사용함  
F : 사용안함

 |
| parent\_comment\_no | 

부모 댓글 번호

 |
| input\_channel | 

쇼핑몰 구분

P : PC  
M : 모바일

 |
| attach\_file\_urls | 

첨부 파일 상세

 |

### Retrieve a list of comments for a board post [](#retrieve-a-list-of-comments-for-a-board-post)cafe24 youtube

GET /api/v2/admin/boards/{board\_no}/articles/{article\_no}/comments

###### GET

특정 게시물에 달린 댓글을 조회할 수 있습니다.  
댓글 내용, 작성자명, 회원아이디 등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 읽기권한 (mall.read\_community)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **board\_no**  
**Required** | 

게시판 번호

 |
| **article\_no**  
**Required** | 

게시물 번호

 |
| comment\_no | 

댓글 번호

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve a list of comments for a board post

*   [Retrieve a list of comments for a board post](#none)
*   [Retrieve comments with fields parameter](#none)
*   [Retrieve comments using paging](#none)
*   [Retrieve a specific comments with comment\_no parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a comment for a board post [](#create-a-comment-for-a-board-post)cafe24 youtube

POST /api/v2/admin/boards/{board\_no}/articles/{article\_no}/comments

###### POST

특정 게시물에 댓글을 추가할 수 있으며, 댓글에 댓글을 추가할 수도 있습니다.  
게시물 번호, 댓글 내용 등을 필수로 입력합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 쓰기권한 (mall.write\_community)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **board\_no**  
**Required** | 

게시판 번호

 |
| **article\_no**  
**Required** | 

게시물 번호

 |
| **content**  
**Required** | 

댓글 내용

 |
| **writer**  
**Required**  

_최대글자수 : \[100자\]_

 | 

작성자명

 |
| **password**  
**Required**  

_글자수 최소: \[1자\]~최대: \[20자\]_

 | 

댓글 비밀번호

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| rating  

_최소: \[1\]~최대: \[5\]_

 | 

댓글 평점

DEFAULT 0

 |
| secret | 

비밀글 여부

T : 사용함  
F : 사용안함

DEFAULT F

 |
| parent\_comment\_no  

_최소값: \[1\]_

 | 

부모 댓글 번호

 |
| input\_channel | 

쇼핑몰 구분

P : PC  
M : 모바일

DEFAULT P

 |
| created\_date  

_날짜_

 | 

생성일

 |
| attach\_file\_urls | 

첨부 파일 상세

 |
| 

attach\_file\_urls 하위 요소 보기

**name**  
파일명

**url**  
파일 URL







 |

Create a comment for a board post

*   [Create a comment for a board post](#none)
*   [Post a comment at an article of a board using only content, writer, and password fields](#none)
*   [Try posting a comment at an article of a board without using content field](#none)
*   [Try posting a comment at an article of a board without using writer field](#none)
*   [Try posting a comment at an article of a board without using password field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a comment for a board post [](#delete-a-comment-for-a-board-post)cafe24

DELETE /api/v2/admin/boards/{board\_no}/articles/{article\_no}/comments/{comment\_no}

###### DELETE

특정 게시물에 달린 댓글을 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 쓰기권한 (mall.write\_community)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **board\_no**  
**Required** | 

게시판 번호

 |
| **article\_no**  
**Required** | 

게시물 번호

 |
| **comment\_no**  
**Required** | 

댓글 번호

 |

Delete a comment for a board post

*   [Delete a comment for a board post](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Boards comments

대량으로 게시판 댓글을 관리하기 위한 기능을 제공합니다.

> Endpoints

```
GET /api/v2/admin/boards/{board_no}/comments
```

#### \[더보기 상세 내용\]

### Boards comments property list[](#boards__comments-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| board\_no | 

게시판 번호

 |
| article\_no | 

게시물 번호

 |
| comment\_no | 

댓글 번호

 |
| content | 

댓글 내용

 |
| writer  

_최대글자수 : \[100자\]_

 | 

작성자명

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| created\_date  

_날짜_

 | 

생성일

 |
| client\_ip  

_IP_

 | 

작성자 IP

 |
| rating  

_최소: \[1\]~최대: \[5\]_

 | 

댓글 평점

 |
| secret | 

비밀글 여부

T : 사용함  
F : 사용안함

 |
| parent\_comment\_no | 

부모 댓글 번호

 |
| input\_channel | 

쇼핑몰 구분

P : PC  
M : 모바일

 |
| attach\_file\_urls | 

첨부 파일 상세

 |
| links | 

link

 |

### Retrieve comments in bulk [](#retrieve-comments-in-bulk)cafe24 youtube

GET /api/v2/admin/boards/{board\_no}/comments

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 읽기권한 (mall.read\_community)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **board\_no**  
**Required** | 

게시판 번호

 |
| since\_comment\_no  

_최소값: \[1\]_  
_최대값: \[2147483647\]_

 | 

해당 댓글번호 이후 검색

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve comments in bulk

*   [Retrieve comments in bulk](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Boards seo

게시판 SEO의 설정을 관리하기 위한 기능을 제공합니다

> Endpoints

```
GET /api/v2/admin/boards/{board_no}/seo
PUT /api/v2/admin/boards/{board_no}/seo
```

#### \[더보기 상세 내용\]

### Boards seo property list[](#boards__seo-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| board\_no | 

게시판 번호

 |
| meta\_title | 

브라우저 타이틀

\[MALL\_NAME\] : 쇼핑몰명  
\[BOARD\_NAME\] : 게시판 제목  
\[BOARD\_GUIDE\] : 게시판 안내글  
\[ARTICLE\_TITLE\] : 게시물 제목

 |
| meta\_author | 

메타태그1 : Author

\[MALL\_NAME\] : 쇼핑몰명  
\[BOARD\_NAME\] : 게시판 제목  
\[BOARD\_GUIDE\] : 게시판 안내글  
\[ARTICLE\_TITLE\] : 게시물 제목

 |
| meta\_description | 

메타태그2 : Description

\[MALL\_NAME\] : 쇼핑몰명  
\[BOARD\_NAME\] : 게시판 제목  
\[BOARD\_GUIDE\] : 게시판 안내글  
\[ARTICLE\_TITLE\] : 게시물 제목

 |
| meta\_keywords | 

메타태그3 : Keywords

\[MALL\_NAME\] : 쇼핑몰명  
\[BOARD\_NAME\] : 게시판 제목  
\[BOARD\_GUIDE\] : 게시판 안내글  
\[ARTICLE\_TITLE\] : 게시물 제목

 |

### Retrieve SEO settings for board [](#retrieve-seo-settings-for-board)cafe24 youtube

GET /api/v2/admin/boards/{board\_no}/seo

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 읽기권한 (mall.read\_community)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **board\_no**  
**Required** | 

게시판 번호

 |

Retrieve SEO settings for board

*   [Retrieve SEO settings for board](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update SEO settings for board [](#update-seo-settings-for-board)cafe24 youtube

PUT /api/v2/admin/boards/{board\_no}/seo

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 쓰기권한 (mall.write\_community)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **board\_no**  
**Required** | 

게시판 번호

 |
| meta\_title  

_최대글자수 : \[100자\]_

 | 

브라우저 타이틀

\[MALL\_NAME\] : 쇼핑몰명  
\[BOARD\_NAME\] : 게시판 제목  
\[BOARD\_GUIDE\] : 게시판 안내글  
\[ARTICLE\_TITLE\] : 게시물 제목

 |
| meta\_author | 

메타태그1 : Author

\[MALL\_NAME\] : 쇼핑몰명  
\[BOARD\_NAME\] : 게시판 제목  
\[BOARD\_GUIDE\] : 게시판 안내글  
\[ARTICLE\_TITLE\] : 게시물 제목

 |
| meta\_description | 

메타태그2 : Description

\[MALL\_NAME\] : 쇼핑몰명  
\[BOARD\_NAME\] : 게시판 제목  
\[BOARD\_GUIDE\] : 게시판 안내글  
\[ARTICLE\_TITLE\] : 게시물 제목

 |
| meta\_keywords | 

메타태그3 : Keywords

\[MALL\_NAME\] : 쇼핑몰명  
\[BOARD\_NAME\] : 게시판 제목  
\[BOARD\_GUIDE\] : 게시판 안내글  
\[ARTICLE\_TITLE\] : 게시물 제목

 |

Update SEO settings for board

*   [Update SEO settings for board](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Commenttemplates

게시판 내에서 자주 사용하는 답변을 관리할 수 있는 기능입니다.

> Endpoints

```
GET /api/v2/admin/commenttemplates
GET /api/v2/admin/commenttemplates/{comment_no}
POST /api/v2/admin/commenttemplates
PUT /api/v2/admin/commenttemplates/{comment_no}
DELETE /api/v2/admin/commenttemplates/{comment_no}
```

#### \[더보기 상세 내용\]

### Commenttemplates property list[](#commenttemplates-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| comment\_no | 

자주 쓰는 답변 번호

 |
| **title**  
**Required**  

_최대글자수 : \[256자\]_

 | 

자주 쓰는 답변 제목

 |
| **content**  
**Required**  

_최대글자수 : \[4000자\]_

 | 

자주 쓰는 답변 내용

 |
| board\_type  

_최소값: \[1\]_

 | 

게시판 분류

1 : 운영  
2 : 일반  
3 : 자료실  
4 : 기타  
5 : 상품  
6 : 갤러리  
7 : 1:1상담  
11 : 한줄메모

 |
| created\_date  

_날짜_

 | 

생성일

 |

### Retrieve frequently used answers [](#retrieve-frequently-used-answers)cafe24 youtube

GET /api/v2/admin/commenttemplates

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 읽기권한 (mall.read\_community)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| board\_type | 

게시판 분류

1 : 운영  
2 : 일반  
3 : 자료실  
4 : 기타  
5 : 상품  
6 : 갤러리  
7 : 1:1상담  
11 : 한줄메모

 |
| title  

_최대글자수 : \[100자\]_

 | 

자주 쓰는 답변 제목

 |
| since\_comment\_no  

_최소값: \[1\]_  
_최대값: \[2147483647\]_

 | 

자주 쓰는 답변 번호

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve frequently used answers

*   [Retrieve frequently used answers](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a frequently used answer [](#retrieve-a-frequently-used-answer)cafe24 youtube

GET /api/v2/admin/commenttemplates/{comment\_no}

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 읽기권한 (mall.read\_community)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **comment\_no**  
**Required**  

_최소값: \[1\]_

 | 

해당 댓글번호 이후 검색

 |

Retrieve a frequently used answer

*   [Retrieve a frequently used answer](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a frequently used answer [](#create-a-frequently-used-answer)cafe24 youtube

POST /api/v2/admin/commenttemplates

###### POST

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 쓰기권한 (mall.write\_community)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **title**  
**Required**  

_최대글자수 : \[256자\]_

 | 

자주 쓰는 답변 제목

 |
| **content**  
**Required**  

_최대글자수 : \[4000자\]_

 | 

자주 쓰는 답변 내용

 |
| **board\_type**  
**Required**  

_최소값: \[1\]_

 | 

게시판 분류

1 : 운영  
2 : 일반  
3 : 자료실  
4 : 기타  
5 : 상품  
6 : 갤러리  
7 : 1:1상담  
11 : 한줄메모

 |

Create a frequently used answer

*   [Create a frequently used answer](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a frequently used answer [](#update-a-frequently-used-answer)cafe24 youtube

PUT /api/v2/admin/commenttemplates/{comment\_no}

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 쓰기권한 (mall.write\_community)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **comment\_no**  
**Required**  

_최소값: \[1\]_

 | 

자주 쓰는 답변 번호

 |
| title  

_최대글자수 : \[256자\]_

 | 

자주 쓰는 답변 제목

 |
| content  

_최대글자수 : \[4000자\]_

 | 

자주 쓰는 답변 내용

 |
| board\_type  

_최소값: \[1\]_

 | 

게시판 분류

1 : 운영  
2 : 일반  
3 : 자료실  
4 : 기타  
5 : 상품  
6 : 갤러리  
7 : 1:1상담  
11 : 한줄메모

 |

Update a frequently used answer

*   [Update a frequently used answer](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a frequently used answer [](#delete-a-frequently-used-answer)cafe24 youtube

DELETE /api/v2/admin/commenttemplates/{comment\_no}

###### DELETE

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 쓰기권한 (mall.write\_community)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **comment\_no**  
**Required**  

_최소값: \[1\]_

 | 

자주 쓰는 답변 번호

 |

Delete a frequently used answer

*   [Delete a frequently used answer](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Financials monthlyreviews

월별 리뷰 통계(Financials monthlyreviews)는 월별 리뷰 정보를 제공합니다. 검색 기간 내의 월별 리뷰 개수 합계, 월별 리뷰 평점 평균을 확인할 수 있습니다

> Endpoints

```
GET /api/v2/admin/financials/monthlyreviews
```

#### \[더보기 상세 내용\]

### Financials monthlyreviews property list[](#financials-monthlyreviews-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| month | 

년월

 |
| count | 

리뷰 개수 합계

 |
| rating\_average | 

리뷰 평점 평균

 |

### Retrieve the total count for monthly reviews and ratings [](#retrieve-the-total-count-for-monthly-reviews-and-ratings)cafe24 youtube

GET /api/v2/admin/financials/monthlyreviews

###### GET

검색 기간 내의 월별 리뷰 정보를 조회합니다.  
월별 리뷰 개수 합계, 월별 리뷰 평점 평균을 확인할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 읽기권한 (mall.read\_community)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **start\_month**  
**Required** | 

검색 시작월

 |
| **end\_month**  
**Required** | 

검색 종료월

 |

Retrieve the total count for monthly reviews and ratings

*   [Retrieve the total count for monthly reviews and ratings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Urgentinquiry

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Urgentinquiry.png)  
  
긴급문의 게시물에 대해 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/urgentinquiry
```

#### \[더보기 상세 내용\]

### Urgentinquiry property list[](#urgentinquiry-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| article\_no | 

게시물 번호

 |
| article\_type | 

게시물 유형

 |
| title | 

제목

 |
| writer | 

작성자명

 |
| member\_id | 

회원아이디

 |
| start\_date  

_날짜_

 | 

작성일 시작일자

 |
| reply\_status | 

답변 처리 상태

F: 미처리  
I: 처리중  
T: 처리완료

 |
| hit | 

조회수

 |
| content | 

내용

 |
| writer\_email  

_이메일_

 | 

작성자 이메일

 |
| phone  

_전화번호_

 | 

전화번호

 |
| search\_type | 

검색 타입

P:상품  
O:주문

 |
| keyword | 

검색어

 |
| attached\_file\_detail | 

첨부 파일 상세

 |

### Retrieve an urgent inquiry post [](#retrieve-an-urgent-inquiry-post)cafe24 youtube

GET /api/v2/admin/urgentinquiry

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 읽기권한 (mall.read\_community)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| start\_date  

_날짜_

 | 

작성일 시작일자

 |
| end\_date  

_날짜_

 | 

작성일 종료일자

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve an urgent inquiry post

*   [Retrieve an urgent inquiry post](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Urgentinquiry reply

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Urgentinquiry%20reply.png)  
  
긴급문의 게시물의 답변글을 조회, 등록, 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/urgentinquiry/{article_no}/reply
POST /api/v2/admin/urgentinquiry/{article_no}/reply
PUT /api/v2/admin/urgentinquiry/{article_no}/reply
```

#### \[더보기 상세 내용\]

### Urgentinquiry reply property list[](#urgentinquiry__reply-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| article\_no | 

게시물 번호

 |
| created\_date  

_날짜_

 | 

답변 등록일

 |
| status | 

답변 처리 상태

F: 미처리  
I: 처리중  
T: 처리완료

 |
| content | 

답변 내용

 |
| method | 

답변 방법

E:이메일  
S:SMS  
A:전부

 |
| count | 

답변 처리 횟수

 |
| user\_id | 

처리중 또는 답변완료 한 운영자 아이디

 |
| attached\_file\_detail | 

첨부 파일 상세

 |

### Retrieve a reply for urgent inquiry post [](#retrieve-a-reply-for-urgent-inquiry-post)cafe24 youtube

GET /api/v2/admin/urgentinquiry/{article\_no}/reply

###### GET

긴급문의 게시물의 답변글을 조회합니다.  
답변 등록일, 답변 처리 상태, 답변 처리 횟수 등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 읽기권한 (mall.read\_community)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **article\_no**  
**Required** | 

게시물 번호

 |

Retrieve a reply for urgent inquiry post

*   [Retrieve a reply for urgent inquiry post](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a reply for urgent inquiry post [](#create-a-reply-for-urgent-inquiry-post)cafe24 youtube

POST /api/v2/admin/urgentinquiry/{article\_no}/reply

###### POST

긴급문의 게시물에 답변글을 등록합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 쓰기권한 (mall.write\_community)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **article\_no**  
**Required** | 

게시물 번호

 |
| **content**  
**Required** | 

답변 내용

 |
| status | 

답변 처리 상태

F: 미처리  
I: 처리중  
T: 처리완료

DEFAULT F

 |
| **user\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

처리중 또는 답변완료 한 운영자 아이디

 |
| attach\_file\_urls | 

첨부 파일 상세

 |
| 

attach\_file\_urls 하위 요소 보기

**name**  
**Required**  
파일명

**url**  
**Required**  
파일 URL







 |

Create a reply for urgent inquiry post

*   [Create a reply for urgent inquiry post](#none)
*   [Try creating a reply without required parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a reply for urgent inquiry post [](#update-a-reply-for-urgent-inquiry-post)cafe24 youtube

PUT /api/v2/admin/urgentinquiry/{article\_no}/reply

###### PUT

긴급문의 게시물의 답변글을 수정합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **게시판 쓰기권한 (mall.write\_community)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **article\_no**  
**Required** | 

게시물 번호

 |
| **content**  
**Required** | 

답변 내용

 |
| status | 

답변 처리 상태

F: 미처리  
I: 처리중  
T: 처리완료

 |
| user\_id  

_최대글자수 : \[20자\]_

 | 

처리중 또는 답변완료 한 운영자 아이디

 |
| attach\_file\_urls | 

첨부 파일 상세

 |
| 

attach\_file\_urls 하위 요소 보기

**name**  
**Required**  
파일명

**url**  
**Required**  
파일 URL







 |

Update a reply for urgent inquiry post

*   [Update a reply for urgent inquiry post](#none)
*   [Try updating a reply without required parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Design

## Icons

디자인 아이콘은 상품, 게시판, 이벤트, 카드, 결제수단 로고로 사용 중인 작은 이미지입니다.  
PC 쇼핑몰과 모바일 쇼핑몰의 아이콘을 모두 확인할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/icons
PUT /api/v2/admin/icons
```

#### \[더보기 상세 내용\]

### Icons property list[](#icons-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| id | 

아이콘 아이디

 |
| type | 

디자인 타입

pc : PC  
mobile : 모바일

 |
| group\_code | 

그룹 코드

A : 상품 아이콘  
B : 게시판 아이콘  
C : 카드 아이콘  
E : 이벤트 아이콘

 |
| path | 

아이콘 URL

 |
| display | 

아이콘 노출여부

T : 노출함  
F : 노출안함

 |
| description | 

아이콘 설명

 |

### Retrieve a list of desgin icons [](#retrieve-a-list-of-desgin-icons)cafe24

GET /api/v2/admin/icons

###### GET

PC와 모바일 쇼핑몰에서 사용하는 아이콘을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **디자인 읽기권한 (mall.read\_design)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| type | 

디자인 타입

pc : PC  
mobile : 모바일

DEFAULT pc

 |

Retrieve a list of desgin icons

*   [Retrieve a list of desgin icons](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update store icon settings [](#update-store-icon-settings)cafe24

PUT /api/v2/admin/icons

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **디자인 쓰기권한 (mall.write\_design)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **id**  
**Required**  

_최소값: \[1\]_

 | 

아이콘 아이디

 |
| **group\_code**  
**Required** | 

그룹 코드

A : 상품 아이콘  
B : 게시판 아이콘  
C : 카드 아이콘  
E : 이벤트 아이콘

 |
| type | 

디자인 타입

pc : PC  
mobile : 모바일

DEFAULT pc

 |
| path  

_URL_

 | 

아이콘 URL

 |
| display | 

아이콘 노출여부

T : 노출함  
F : 노출안함

 |

Update store icon settings

*   [Update store icon settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Themes

디자인(Themes)은 쇼핑몰에 사용하기 위해 구매하거나 혹은 직접 만든 디자인과 관련된 기능입니다.  
PC 쇼핑몰과 모바일 쇼핑몰의 디자인을 모두 확인할 수 있습니다.  
디자인 목록에 있는 디자인 중 대표 디자인을 지정하면 쇼핑몰의 디자인이 해당 디자인으로 변경됩니다.  
  
![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Themes.png)

> Endpoints

```
GET /api/v2/admin/themes
GET /api/v2/admin/themes/count
GET /api/v2/admin/themes/{skin_no}
```

#### \[더보기 상세 내용\]

### Themes property list[](#themes-property-list)

| **Attribute** | **Description** |
| --- | --- |
| skin\_no  
_최소값: \[1\]_

 | 

디자인 번호

 |
| skin\_code | 

디자인 코드

 |
| skin\_name  

_최대글자수 : \[100자\]_

 | 

디자인명

 |
| skin\_thumbnail\_url  

_최대글자수 : \[255자\]_

 | 

디자인 썸네일 이미지 URL

 |
| usage\_type | 

디자인 용도 구분

S : PC 기본스킨  
C : PC 복사된 스킨  
I : PC 상속된 스킨  
M : 모바일 기본스킨/상속된 스킨  
N : 모바일 복사된 스킨

 |
| editor\_type | 

에디터 타입

H : 스마트 디자인 (HTML)  
D : 에디봇 디자인 (Drag & Drop)  
W : 심플 디자인 (WYSIWYG)  
E : 스마트디자인Easy

 |
| parent\_skin\_no | 

부모 디자인 번호

 |
| seller\_id | 

판매자 디자인센터 아이디

 |
| seller\_skin\_code | 

판매자 디자인 코드

 |
| design\_purchase\_no  

_최소값: \[0\]_

 | 

디자인 구매 번호

 |
| design\_product\_code | 

디자인센터 상품 코드

 |
| language\_code  

_최소글자수 : \[5자\]_  
_최대글자수 : \[5자\]_

 | 

언어 코드

ko\_KR : 국문  
en\_US : 영문  
zh\_CN : 중문(간체)  
zh\_TW : 중문(번체)  
ja\_JP : 일문  
pt\_PT : 포르투갈어  
es\_ES : 스페인어  
vi\_VN : 베트남어

 |
| published\_in | 

대표디자인 설정 멀티쇼핑몰 번호

 |
| created\_date  

_날짜_

 | 

생성일

 |
| updated\_date  

_날짜_

 | 

수정일

 |
| preview\_domain | 

도메인 조회

 |
| skin\_lock | 

디자인 잠금

T : 잠금  
F : 해제

 |

### Retrieve a list of themes [](#retrieve-a-list-of-themes)cafe24

GET /api/v2/admin/themes

###### GET

PC 쇼핑몰 혹은 모바일 쇼핑몰의 전체 디자인들의 정보를 목록으로 조회할 수 있습니다.  
디자인코드, 디자인명, 언어코드 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **디자인 읽기권한 (mall.read\_design)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| type | 
디자인 타입

pc : PC  
mobile : 모바일

DEFAULT pc

 |

Retrieve a list of themes

*   [Retrieve a list of themes](#none)
*   [Retrieve themes with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of themes [](#retrieve-a-count-of-themes)cafe24

GET /api/v2/admin/themes/count

###### GET

쇼핑몰의 디자인의 수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **디자인 읽기권한 (mall.read\_design)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| type | 
디자인 타입

pc : PC  
mobile : 모바일

DEFAULT pc

 |

Retrieve a count of themes

*   [Retrieve a count of themes](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a theme [](#retrieve-a-theme)cafe24

GET /api/v2/admin/themes/{skin\_no}

###### GET

쇼핑몰의 특정 스킨번호(디자인 번호)의 정보를 조회할 수 있습니다.  
디자인코드, 디자인명 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **디자인 읽기권한 (mall.read\_design)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| skin\_no  
_최소값: \[1\]_

 | 

디자인 번호

 |

Retrieve a theme

*   [Retrieve a theme](#none)
*   [Retrieve a theme with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Themes pages

테마 페이지(Themes pages)는 쇼핑몰의 디자인 테마의 페이지에 대한 조회, 설정, 수정, 삭제를 하는 기능입니다.  
테마 페이지는 하위 리소스로 테마(Themes) 하위에서만 사용할 수 있습니다.  
  
![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Themes%20pages.png)

> Endpoints

```
GET /api/v2/admin/themes/{skin_no}/pages
POST /api/v2/admin/themes/{skin_no}/pages
PUT /api/v2/admin/themes/{skin_no}/pages
DELETE /api/v2/admin/themes/{skin_no}/pages
```

#### \[더보기 상세 내용\]

### Themes pages property list[](#themes__pages-property-list)

| **Attribute** | **Description** |
| --- | --- |
| skin\_no | 
디자인 번호

 |
| skin\_code | 

디자인 코드

 |
| path | 

파일 경로

 |
| source | 

소스 코드

 |
| display\_location | 

화면 분류

 |

### Retrieve a theme page [](#retrieve-a-theme-page)cafe24

GET /api/v2/admin/themes/{skin\_no}/pages

###### GET

스킨을 지정한 테마 페이지를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **디자인 읽기권한 (mall.read\_design)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **skin\_no**  
**Required** | 
디자인 번호

 |
| **path**  
**Required** | 

파일 경로

 |

Retrieve a theme page

*   [Retrieve a theme page](#none)
*   [Retrieve pages with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a theme page [](#create-a-theme-page)cafe24

POST /api/v2/admin/themes/{skin\_no}/pages

###### POST

테마 페이지를 설정합니다.  
디자인 테마를 특정 경로에 설정할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **디자인 쓰기권한 (mall.write\_design)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **skin\_no**  
**Required** | 
디자인 번호

 |
| **path**  
**Required** | 

파일/디렉토리 경로

 |
| source | 

소스 코드

 |
| display\_location | 

화면 분류

 |

Create a theme page

*   [Create a theme page](#none)
*   [Set a certain design skin to a certain path by using only required fields](#none)
*   [Try setting a certain design skin to a certain path without using path field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a theme page [](#update-a-theme-page)cafe24

PUT /api/v2/admin/themes/{skin\_no}/pages

###### PUT

스킨을 지정한 테마 페이지를 수정할 수 있습니다.  
경로(path)를 수정하기 위해서는 삭제 후 다시 설정하여야 합니다.  
소스코드를 수정할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **디자인 쓰기권한 (mall.write\_design)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **skin\_no**  
**Required** | 
디자인 번호

 |
| **path**  
**Required** | 

파일 경로

 |
| **source**  
**Required** | 

소스 코드

 |

Update a theme page

*   [Update a theme page](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a theme page [](#delete-a-theme-page)cafe24

DELETE /api/v2/admin/themes/{skin\_no}/pages

###### DELETE

스킨을 지정한 테마 페이지를 삭제할 수 있습니다.  
페이지 자체가 삭제되는것은 아니며 디자인만 기본 디자인으로 돌아갑니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **디자인 쓰기권한 (mall.write\_design)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **skin\_no**  
**Required** | 
디자인 번호

 |
| **path**  
**Required** | 

파일 경로

 |

Delete a theme page

*   [Delete a theme page](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Promotion

## Benefits

혜택(Benefits)은 쇼핑몰 고객에게 제공하는 증정 또는 할인과 같은 고객 혜택입니다.  
혜택 리소스를 통해 고객에게 증정 또는 할인 등의 프로모션을 생성하거나 수정, 삭제할 수 있고 생성되어있는 혜택 정보를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/benefits
GET /api/v2/admin/benefits/count
GET /api/v2/admin/benefits/{benefit_no}
POST /api/v2/admin/benefits
PUT /api/v2/admin/benefits/{benefit_no}
DELETE /api/v2/admin/benefits/{benefit_no}
```

#### \[더보기 상세 내용\]

### Benefits property list[](#benefits-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호

 |
| benefit\_no | 

혜택번호

혜택이 생성된 경우 부여되는 고유 번호

 |
| use\_benefit | 

진행여부

 |
| benefit\_name  

_최대글자수 : \[255자\]_

 | 

혜택명

 |
| benefit\_division | 

혜택 유형

해당 혜택의 유형으로, 할인과 증정으로 구분됨

 |
| benefit\_type | 

혜택 상세유형

해당 혜택의 상세유형  
  
할인 : 기간할인, 재구매할인, 대량구매할인, 회원할인, 신규상품할인, 배송비할인  
증정 : 사은품증정, 1+N 이벤트

 |
| use\_benefit\_period | 

혜택 기간 설정

해당 혜택이 적용되는 기간을 설정했는지 여부

 |
| benefit\_start\_date  

_날짜_

 | 

혜택 시작일

혜택이 적용되는 기간을 설정한 경우, 해당 혜택이 시작되는 일시

 |
| benefit\_end\_date  

_날짜_

 | 

혜택 종료일

혜택이 적용되는 기간을 설정한 경우, 해당 혜택이 종료되는 일시

 |
| platform\_types | 

혜택 사용범위

해당 혜택이 적용되는 범위 (PC, 모바일, 플러스앱)

 |
| use\_group\_binding | 

참여대상 설정

해당 혜택이 적용되는 대상을 설정 (회원+비회원, 비회원, 회원)

 |
| customer\_group\_list | 

회원 등급

참여대상을 회원으�� 설정한 경우, 참여가 가능한 회원등급을 설정

 |
| product\_binding\_type | 

상품 범위

해당 혜택이 적용되는 상품의 범위  
  
전체상품 : 전체 상품에 혜택 적용  
특정상품 : 선택한 특정 상품에 대해서만 혜택 적용  
제외상품 : 선택한 특정 상품에 대해서만 혜택 적용 제외  
상품분류 : 선택한 상품 분류에 속한 상품에 대해서만 혜택 적용

 |
| use\_except\_category | 

상품분류 혜택제외

특정 상품분류에 대해 혜택 적용을 제외함 (각 유형별로 설정 가능여부가 다름)  
  
기간할인 : 전체상품, 특정상품인 경우 설정 가능  
신규상품할인 : 전체상품인 경우 설정 가능  
  
그 외 할인 및 증정유형에서는 설정 불가

 |
| available\_coupon | 

쿠폰 사용범위

쿠폰이 있는 경우, 쿠폰을 중복하여 사용할 수 있는지 여부

 |
| icon\_url | 

아이콘 URL

혜택이 적용되는 상품명에 아이콘이 노출되도록 아이콘 등록

 |
| created\_date | 

혜택 등록일

해당 혜택이 등록된 일시

 |
| repurchase\_sale | 

재구매 할인 설정

혜택의 상세유형이 재구매 할인인 경우 그와 관련한 상세 설정

 |
| bulk\_purchase\_sale | 

대량구매 수량 설정

혜택의 상세유형이 대량구매 할인인 경우 그와 관련한 상세 설정

 |
| member\_sale | 

회원 할인 설정

혜택의 상세유형이 회원 할인인 경우 그와 관련한 상세 설정

 |
| period\_sale | 

기간 할인 설정

혜택의 상세유형이 기간 할인인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 등록이 가능함

 |
| new\_product\_sale | 

신규상품할인 설정

혜택의 상세유형이 신규상품 할인인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 등록이 가능함

 |
| shipping\_fee\_sale | 

배송비 할인 설정

혜택의 상세유형이 배송비 할인인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 등록이 가능함

 |
| gift | 

사은품 설정

혜택의 상세유형이 사은품 증정인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 등록이 가능함

 |
| gift\_product\_bundle | 

1+N 이벤트 설정

혜택의 상세유형이 1+N 이벤트인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 등록이 가능함

 |

### Retrieve a list of customer benefits [](#retrieve-a-list-of-customer-benefits)cafe24

GET /api/v2/admin/benefits

###### GET

혜택을 목록으로 조회할 수 있습니다.  
혜택의 진행여부, 혜택명, 혜택유형 등을 조회할 수 있습니다.  
현재 진행중인 혜택만 조회하거나 특정 기간을 통해 혜택을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호

DEFAULT 1

 |
| use\_benefit | 

진행여부

T : 진행함  
F : 진행안함

 |
| benefit\_name | 

혜택명

 |
| benefit\_type | 

혜택 상세유형

해당 혜택의 상세유형

DP : 기간할인  
DR : 재구매할인  
DQ : 대량구매할인  
DM : 회원할인  
DN : 신규상품할인  
DV : 배송비할인  
PG : 사은품  
PB : 1+N 이벤트

 |
| period\_type | 

혜택 기간 타입

R : 혜택 등록일  
S : 혜택 시작일  
E : 혜택 종료일

 |
| benefit\_start\_date  

_날짜_

 | 

검색 시작일

 |
| benefit\_end\_date  

_날짜_

 | 

검색 종료일

 |
| platform\_types | 

혜택 사용범위

,(콤마)로 여러 건을 검색할 수 있다.

P : PC 쇼핑몰  
M : 모바일쇼핑몰  
A : 플러스앱

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve a list of customer benefits

*   [Retrieve a list of customer benefits](#none)
*   [Retrieve benefits with fields parameter](#none)
*   [Retrieve benefits using paging](#none)
*   [Retrieve a specific benefits with benefit\_name parameter](#none)
*   [Retrieve multiple benefits](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of customer benefits [](#retrieve-a-count-of-customer-benefits)cafe24

GET /api/v2/admin/benefits/count

###### GET

혜택의 수를 조회할 수 있습니다.  
현재 진행중인 혜택만 조회하거나 특정 기간을 통해 혜택을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호

DEFAULT 1

 |
| use\_benefit | 

진행여부

T : 진행함  
F : 진행안함

 |
| benefit\_name | 

혜택명

 |
| benefit\_type | 

혜택 상세유형

해당 혜택의 상세유형

DP : 기간할인  
DR : 재구매할인  
DQ : 대량구매할인  
DM : 회원할인  
DN : 신규상품할인  
DV : 배송비할인  
PG : 사은품  
PB : 1+N 이벤트

 |
| period\_type | 

혜택 기간 타입

R : 혜택 등록일  
S : 혜택 시작일  
E : 혜택 종료일

 |
| benefit\_start\_date  

_날짜_

 | 

검색 시작일

 |
| benefit\_end\_date  

_날짜_

 | 

검색 종료일

 |
| platform\_types | 

혜택 사용범위

,(콤마)로 여러 건을 검색할 수 있다.

P : PC 쇼핑몰  
M : 모바일쇼핑몰  
A : 플러스앱

 |

Retrieve a count of customer benefits

*   [Retrieve a count of customer benefits](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a customer benefit [](#retrieve-a-customer-benefit)cafe24

GET /api/v2/admin/benefits/{benefit\_no}

###### GET

특정 혜택을 상세 조회할 수 있습니다.  
목록 조회에서는 제공되지 않는 기간할인, 회원 할인 등의 상세 설정을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **benefit\_no**  
**Required** | 

혜택번호

혜택이 생성된 경우 부여되는 고유 번호

 |

Retrieve a customer benefit

*   [Retrieve a customer benefit](#none)
*   [Retrieve a benefit with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a customer benefit [](#create-a-customer-benefit)cafe24

POST /api/v2/admin/benefits

###### POST

혜택을 새롭게 생성할 수 있습니다.  
할인 또는 증정 중에 선택할 수 있으며 혜택 대상과 할인 기간 등을 선택할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호

DEFAULT 1

 |
| shop\_no | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호

 |
| **use\_benefit**  
**Required** | 

진행여부

T : 진행함  
F : 진행안함

 |
| **benefit\_name**  
**Required**  

_최대글자수 : \[255자\]_

 | 

혜택명

 |
| **benefit\_division**  
**Required** | 

혜택 유형

해당 혜택의 유형으로, 할인과 증정으로 구분됨

D : 할인  
P : 증정

 |
| **benefit\_type**  
**Required** | 

혜택 상세유형

해당 혜택의 상세유형

DP : 기간할인  
DR : 재구매할인  
DQ : 대량구매할인  
DM : 회원할인  
DN : 신규상품할인  
DV : 배송비할인  
PG : 사은품  
PB : 1+N 이벤트

 |
| use\_benefit\_period | 

혜택 기간 설정

해당 혜택이 적용되는 기간을 설정할지 여부  
  
사용함으로 설정하는 경우, 혜택 시작일과 종료일을 입력해야 함

T : 사용함  
F : 사용안함

 |
| benefit\_start\_date  

_날짜_

 | 

혜택 시작일

혜택이 적용되는 기간을 설정한 경우, 해당 혜택이 시작되는 일시

 |
| benefit\_end\_date  

_날짜_

 | 

혜택 종료일

혜택이 적용되는 기간을 설정한 경우, 해당 혜택이 종료되는 일시

 |
| **platform\_types**  
**Required** | 

혜택 사용범위

해당 혜택이 적용되는 범위

P : PC 쇼핑몰  
M : 모바일쇼핑몰  
A : 플러스앱

 |
| use\_group\_binding | 

참여대상 설정

해당 혜택이 적용되는 대상을 설정

A : 회원 + 비회원  
N : 비회원  
M : 회원

 |
| customer\_group\_list | 

회원 등급

참여대상을 회원으로 설정한 경우, 참여가 가능한 회원등급을 설정

 |
| product\_binding\_type | 

상품 범위

해당 혜택이 적용되는 상품의 범위

A : 전체상품  
P : 특정상품  
E : 제외상품  
C : 상품분류

 |
| use\_except\_category | 

상품분류 혜택제외

특정 상품분류에 대해 혜택 적용을 제외함 (각 유형별로 설정 가능여부가 다름)  
  
기간할인 : 전체상품, 특정상품인 경우 설정 가능  
신규상품할인 : 전체상품인 경우 설정 가능  
  
그 외 할인 및 증정유형에서는 설정 불가

T : 사용함  
F : 사용안함

 |
| available\_coupon | 

쿠폰 사용범위

쿠폰이 있는 경우, 쿠폰을 중복하여 사용할 수 있는지 여부

T : 모든 쿠폰 사용가능  
F : 모든 쿠폰 사용제한

 |
| period\_sale | 

기간 할인 설정

혜택의 상세유형이 기간 할인인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 등록이 가능함  
  
할인 금액(discount\_value\_unit)이 비율(P)인 경우 할인 반올림 단위(discount\_truncation\_unit), 할인 단위 처리(discount\_truncation\_method) 필수 입력  
  
할인 금액(discount\_value\_unit)이 금액(W)인 경우 discount\_purchasing\_quantity 필수 입력

 |
| 

period\_sale 하위 요소 보기

**product\_list**  
상품 목록

**add\_category\_list**  
상품 분류

**except\_category\_list**  
제외 분류

**discount\_purchasing\_quantity**  
할인 구매수량  
T : 구매수량에 따라  
F : 구매수량에 관계없이

**discount\_value**  
할인 값

**discount\_value\_unit**  
할인 기준  
P : 비율  
W : 금액

**discount\_truncation\_unit**  
할인 반올림 단위  
F : 절사안함  
C : 0.01  
B : 0.1  
O : 1  
T : 10  
M : 100  
H : 1000

**discount\_truncation\_method**  
할인 단위 처리  
L : 내림  
U : 반올림  
C : 올림







 |
| repurchase\_sale | 

재구매 할인 설정

혜택의 상세유형이 재구매 할인인 경우 그와 관련한 상세 설정

 |
| 

repurchase\_sale 하위 요소 보기

**product\_list**  
상품 목록

**purchase\_item\_type**  
구매 횟수 설정  
P : 상품  
I : 품목

**purchase\_times**  
**Required**  
구매횟수 제한 수량

**discount\_purchasing\_quantity**  
할인 구매수량  
T : 구매수량에 따라  
F : 구매수량에 관계없이

**discount\_value**  
할인 값

**discount\_value\_unit**  
할인 기준  
P : 비율  
W : 금액

**discount\_truncation\_unit**  
할인 반올림 단위  
F : 절사안함  
C : 0.01  
B : 0.1  
O : 1  
T : 10  
M : 100  
H : 1000

**discount\_truncation\_method**  
할인 단위 처리  
L : 내림  
U : 반올림  
C : 올림







 |
| bulk\_purchase\_sale | 

대량구매 수량 설정

혜택의 상세유형이 대량구매 할인인 경우 그와 관련한 상세 설정

 |
| 

bulk\_purchase\_sale 하위 요소 보기

**product\_list**  
상품 목록

**bulk\_purchase\_item\_type**  
대량구매 수량 설정  
P : 상품  
I : 품목  
DEFAULT P

**bulk\_purchase\_begin\_quantity**  
**Required**  
구매수량 제한 (n 이상)

**bulk\_purchase\_limit\_quantity**  
**Required**  
구매수량 제한 (n 미만)

**discount\_purchasing\_quantity**  
할인 구매수량  
T : 구매수량에 따라  
F : 구매수량에 관계없이

**discount\_value**  
할인 값

**discount\_value\_unit**  
할인 기준  
P : 비율  
W : 금액

**discount\_truncation\_unit**  
할인 반올림 단위  
F : 절사안함  
C : 0.01  
B : 0.1  
O : 1  
T : 10  
M : 100  
H : 1000

**discount\_truncation\_method**  
할인 단위 처리  
L : 내림  
U : 반올림  
C : 올림







 |
| member\_sale | 

회원 할인 설정

혜택의 상세유형이 회원 할인인 경우 그와 관련한 상세 설정

 |
| 

member\_sale 하위 요소 보기

**product\_list**  
상품 목록

**discount\_purchasing\_quantity**  
할인 구매수량  
T : 구매수량에 따라  
F : 구매수량에 관계없이

**discount\_value**  
할인 값

**discount\_value\_unit**  
할인 기준  
P : 비율  
W : 금액

**discount\_truncation\_unit**  
할인 반올림 단위  
F : 절사안함  
C : 0.01  
B : 0.1  
O : 1  
T : 10  
M : 100  
H : 1000

**discount\_truncation\_method**  
할인 단위 처리  
L : 내림  
U : 반올림  
C : 올림







 |
| gift | 

사은품 설정

혜택의 상세유형이 사은품 증정인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 등록이 가능함

 |
| 

gift 하위 요소 보기

**product\_list**  
상품 목록

**add\_category\_list**  
상품 분류

**offer\_only\_first**  
첫 구매 여부  
T : 사용함  
F : 사용안함

**first\_purchase\_type**  
첫 구매 기준  
O : 주문기준  
D : 배송완료 기준

**use\_unlimited\_price**  
최대가격 제한여부  
T : 사용함  
F : 사용안함

**purchase\_start\_price**  
구매가격 제한 (n 이상)

**purchase\_limit\_price**  
구매가격 제한 (n 미만)

**gift\_product\_list** _Array_

gift\_product\_list 하위 요소 보기

**product\_no**  
상품번호  
**Required**

**gift\_point**  
차감 점수  
**Required**

**max\_count**  
최대 선택 수량













 |
| new\_product\_sale | 

신규상품할인 설정

혜택의 상세유형이 신규상품 할인인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 등록이 가능함  
  
할인 금액(discount\_value\_unit)이 비율(P)인 경우 할인 반올림 단위(discount\_truncation\_unit), 할인 단위 처리(discount\_truncation\_method) 필수 입력  
  
할인 금액(discount\_value\_unit)이 금액(W)인 경우 discount\_purchasing\_quantity 필수 입력

 |
| 

new\_product\_sale 하위 요소 보기

**product\_list**  
상품 목록

**add\_category\_list**  
상품 분류

**except\_category\_list**  
제외 분류

**new\_product\_date\_type**  
**Required**  
신상품 설정 기준일  
I : 상품 등록일  
U : 상품 최종 수정일  
V : 상품 최종 진열일

**new\_product\_day**  
**Required**  
신상품 설정 값

**new\_product\_term\_type**  
**Required**  
신상품 설정 단위  
D : 일  
H : 시간

**discount\_purchasing\_quantity**  
할인 구매수량  
T : 구매수량에 따라  
F : 구매수량에 관계없이

**discount\_value**  
**Required**  
할인 값

**discount\_value\_unit**  
할인 기준  
P : 비율  
W : 금액

**discount\_truncation\_unit**  
할인 반올림 단위  
F : 절사안함  
C : 0.01  
B : 0.1  
O : 1  
T : 10  
M : 100  
H : 1000

**discount\_truncation\_method**  
할인 단위 처리  
L : 내림  
U : 반올림  
C : 올림







 |
| shipping\_fee\_sale | 

배송비 할인 설정

혜택의 상세유형이 배송비 할인인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 등록이 가능함

 |
| 

shipping\_fee\_sale 하위 요소 보기

**product\_list**  
상품 목록

**use\_purchase\_price\_condition**  
금액 기준 사용여부  
T : 사용함  
F : 사용안함

**total\_purchase\_price**  
금액 제한

**include\_regional\_shipping\_rate**  
지역별배송비 포함여부값  
T : 포함  
F : 미포함







 |
| gift\_product\_bundle | 

1+N 이벤트 설정

혜택의 상세유형이 1+N 이벤트인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 등록이 가능함

 |
| 

gift\_product\_bundle 하위 요소 보기

**product\_list**  
상품 목록

**product\_bundle\_type**  
**Required**  
혜택 설정  
P : 상품  
I : 품목

**product\_bundle\_count**  
**Required**  
추가 상품 수량







 |
| icon\_url | 

아이콘 URL

혜택이 적용되는 상품명에 아이콘이 노출되도록 아이콘 등록

 |

Create a customer benefit

*   [Create a customer benefit](#none)
*   [Trying to create a promotion without benefit\_type](#none)
*   [Create a promotion of period discount](#none)
*   [Create a promotion of new product discount](#none)
*   [Create a promotion of shipping fee discount](#none)
*   [Create a promotion of gift](#none)
*   [Create a promotion of 1+N gift](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a customer benefit [](#update-a-customer-benefit)cafe24

PUT /api/v2/admin/benefits/{benefit\_no}

###### PUT

특정 혜택을 수정할 수 있습니다.  
할인 유형을 제외하고 혜택 기간이나 진행 여부, 혜택 명 등의 세부 정보를 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호

DEFAULT 1

 |
| **benefit\_no**  
**Required** | 

혜택번호

혜택이 생성된 경우 부여되는 고유 번호

 |
| use\_benefit | 

진행여부

T : 진행함  
F : 진행안함

 |
| benefit\_name  

_최대글자수 : \[255자\]_

 | 

혜택명

 |
| use\_benefit\_period | 

혜택 기간 설정

해당 혜택이 적용되는 기간을 설정할지 여부

T : 사용함  
F : 사용안함

 |
| benefit\_start\_date  

_날짜_

 | 

혜택 시작일

혜택이 적용되는 기간을 설정한 경우, 해당 혜택이 시작되는 일시  
  
혜택 시작일을 수정하고자 하는 경우, use\_benefit\_period 파라미터를 반드시 선언해야 함

 |
| benefit\_end\_date  

_날짜_

 | 

혜택 종료일

혜택이 적용되는 기간을 설정한 경우, 해당 혜택이 종료되는 일시  
  
혜택 종료일을 수정하고자 하는 경우, use\_benefit\_period 파라미터를 반드시 선언해야 함

 |
| platform\_types | 

혜택 사용범위

해당 혜택이 적용되는 범위

P : PC 쇼핑몰  
M : 모바일쇼핑몰  
A : 플러스앱

 |
| use\_group\_binding | 

참여대상 설정

해당 혜택이 적용되는 대상을 설정

A : 회원 + 비회원  
N : 비회원  
M : 회원

 |
| customer\_group\_list | 

회원 등급

참여대상을 회원으로 설정한 경우, 참여가 가능한 회원등급을 설정  
  
회원 등급을 수정하고자 하는 경우, use\_group\_binding 파라미터를 반드시 선언해야 함

 |
| product\_binding\_type | 

상품 범위

해당 혜택이 적용되는 상품의 범위  
  
상품 범위가 P,E,C 인 경우 기존에 설정된 상품 또는 분류를 수정하고자 하는 경우 product\_binding\_type 파라미터를 반드시 선언해야 함

A : 전체상품  
P : 특정상품  
E : 제외상품  
C : 상품분류

 |
| use\_except\_category | 

상품분류 혜택제외

특정 상품분류에 대해 혜택 적용을 제외함 (각 유형별로 설정 가능여부가 다름)  
  
기간할인 : 전체상품, 특정상품인 경우 설정 가능  
신규상품할인 : 전체상품인 경우 설정 가능  
  
그 외 할인 및 증정유형에서는 설정 불가  
  
기존에 설정된 제외 분류를 수정하고자 하는 경우, use\_except\_category 파라미터를 반드시 선언해야 함

T : 사용함  
F : 사용안함

 |
| available\_coupon | 

쿠폰 사용범위

쿠폰이 있는 경우, 쿠폰을 중복하여 사용할 수 있는지 여부

T : 모든 쿠폰 사용가능  
F : 모든 쿠폰 사용제한

 |
| period\_sale | 

기간 할인 설정

혜택의 상세유형이 기간 할인인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 수정이 가능함  
  
할인 금액(discount\_value\_unit)이 비율(P)인 경우 할인 반올림 단위(discount\_truncation\_unit), 할인 단위 처리(discount\_truncation\_method) 필수 입력  
  
할인 금액(discount\_value\_unit)이 금액(W)인 경우 discount\_purchasing\_quantity 필수 입력

 |
| 

period\_sale 하위 요소 보기

**product\_list**  
상품 목록

**add\_category\_list**  
상품 분류

**except\_category\_list**  
제외 분류

**discount\_purchasing\_quantity**  
할인 구매수량  
T : 구매수량에 따라  
F : 구매수량에 관계없이

**discount\_value**  
할인 값

**discount\_value\_unit**  
할인 기준  
P : 비율  
W : 금액

**discount\_truncation\_unit**  
할인 반올림 단위  
F : 절사안함  
C : 0.01  
B : 0.1  
O : 1  
T : 10  
M : 100  
H : 1000

**discount\_truncation\_method**  
할인 단위 처리  
L : 내림  
U : 반올림  
C : 올림







 |
| gift | 

사은품 설정

혜택의 상세유형이 사은품 증정인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 수정이 가능함

 |
| 

gift 하위 요소 보기

**product\_list**  
상품 목록

**add\_category\_list**  
상품 분류

**offer\_only\_first**  
첫 구매 여부  
T : 사용함  
F : 사용안함

**first\_purchase\_type**  
첫 구매 기준  
O : 주문기준  
D : 배송완료 기준

**use\_unlimited\_price**  
최대가격 제한여부  
T : 사용함  
F : 사용안함

**purchase\_start\_price**  
구매가격 제한 (n 이상)

**purchase\_limit\_price**  
구매가격 제한 (n 미만)

**gift\_product\_list** _Array_

gift\_product\_list 하위 요소 보기

**product\_no**  
상품번호

**gift\_point**  
차감 점수

**max\_count**  
최대 선택 수량













 |
| gift\_product\_bundle | 

1+N 이벤트 설정

혜택의 상세유형이 1+N 이벤트인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 수정이 가능함

 |
| 

gift\_product\_bundle 하위 요소 보기

**product\_list**  
상품 목록

**product\_bundle\_count**  
추가 상품 수량







 |
| new\_product\_sale | 

신규상품할인 설정

혜택의 상세유형이 신규상품 할인인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 수정이 가능함  
  
할인 금액(discount\_value\_unit)이 비율(P)인 경우 할인 반올림 단위(discount\_truncation\_unit), 할인 단위 처리(discount\_truncation\_method) 필수 입력  
  
할인 금액(discount\_value\_unit)이 금액(W)인 경우 discount\_purchasing\_quantity 필수 입력

 |
| 

new\_product\_sale 하위 요소 보기

**product\_list**  
상품 목록

**add\_category\_list**  
상품 분류

**except\_category\_list**  
제외 분류

**new\_product\_date\_type**  
신상품 설정 기준일  
I : 상품 등록일  
U : 상품 최종 수정일  
V : 상품 최종 진열일

**new\_product\_day**  
신상품 설정 값

**new\_product\_term\_type**  
신상품 설정 단위  
D : 일  
H : 시간

**discount\_purchasing\_quantity**  
할인 구매수량  
T : 구매수량에 따라  
F : 구매수량에 관계없이

**discount\_value**  
할인 값

**discount\_value\_unit**  
할인 기준  
P : 비율  
W : 금액

**discount\_truncation\_unit**  
할인 반올림 단위  
F : 절사안함  
C : 0.01  
B : 0.1  
O : 1  
T : 10  
M : 100  
H : 1000

**discount\_truncation\_method**  
할인 단위 처리  
L : 내림  
U : 반올림  
C : 올림







 |
| shipping\_fee\_sale | 

배송비 할인 설정

혜택의 상세유형이 배송비 할인인 경우 그와 관련한 상세 설정  
하위 요소가 입력되어야 정상적인 수정이 가능함

 |
| 

shipping\_fee\_sale 하위 요소 보기

**product\_list**  
상품 목록

**use\_purchase\_price\_condition**  
금액 기준 사용여부  
T : 사용함  
F : 사용안함

**total\_purchase\_price**  
금액 제한

**include\_regional\_shipping\_rate**  
지역별배송비 포함여부값  
T : 포함  
F : 미포함







 |
| icon\_url | 

아이콘 URL

혜택이 적용되는 상품명에 아이콘이 노출되도록 아이콘 등록  
(빈 값으로 요청 시, 기존에 등록된 아이콘 삭제됨)

 |

Update a customer benefit

*   [Update a customer benefit](#none)
*   [Update target participants of benefits to member only](#none)
*   [Update discount rates of the benefits to 15%](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a customer benefit [](#delete-a-customer-benefit)cafe24

DELETE /api/v2/admin/benefits/{benefit\_no}

###### DELETE

생성된 혜택을 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호

DEFAULT 1

 |
| **benefit\_no**  
**Required** | 

혜택번호

혜택이 생성된 경우 부여되는 고유 번호

 |

Delete a customer benefit

*   [Delete a customer benefit](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Commonevents

> Endpoints

```
GET /api/v2/admin/commonevents
POST /api/v2/admin/commonevents
PUT /api/v2/admin/commonevents/{event_no}
DELETE /api/v2/admin/commonevents/{event_no}
```

#### \[더보기 상세 내용\]

### Commonevents property list[](#commonevents-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| event\_no | 

이벤트 번호

 |
| name | 

이벤트 이름

 |
| status | 

이벤트 상태

 |
| category\_no | 

카테고리 번호

 |
| register\_date | 

등록일

 |
| display\_position | 

표시 위치

 |
| content | 

내용

 |

### Retrieve a list of storewide promotions [](#retrieve-a-list-of-storewide-promotions)cafe24

GET /api/v2/admin/commonevents

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| limit  

_최대값: \[100\]_

 | 

조회결과 최대건수

DEFAULT 20

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

 |

Retrieve a list of storewide promotions

*   [Retrieve a list of storewide promotions](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a storewide promotion [](#create-a-storewide-promotion)cafe24

POST /api/v2/admin/commonevents

###### POST

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **name**  
**Required**  

_최대글자수 : \[255자\]_

 | 

이벤트 이름

 |
| status | 

이벤트 상태

T: 진행  
F: 진행안함

DEFAULT T

 |
| category\_no  

_최소값: \[0\]_

 | 

카테고리 번호

0: 전체

DEFAULT 0

 |
| display\_position | 

표시 위치

top\_detail: 상품상세정보 위  
side\_image: 상품이미지 옆

DEFAULT top\_detail

 |
| content | 

내용

 |

Create a storewide promotion

*   [Create a storewide promotion](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a storewide promotion [](#update-a-storewide-promotion)cafe24

PUT /api/v2/admin/commonevents/{event\_no}

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **event\_no**  
**Required**  

_최소값: \[1\]_

 | 

이벤트 번호

 |
| name  

_최대글자수 : \[255자\]_

 | 

이벤트 이름

 |
| status | 

이벤트 상태

T: 진행  
F: 진행안함

 |
| category\_no  

_최소값: \[0\]_

 | 

카테고리 번호

0: 전체

 |
| display\_position | 

표시 위치

top\_detail: 상품상세정보 위  
side\_image: 상품이미지 옆

 |
| content | 

내용

 |

Update a storewide promotion

*   [Update a storewide promotion](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a storewide promotion [](#delete-a-storewide-promotion)cafe24

DELETE /api/v2/admin/commonevents/{event\_no}

###### DELETE

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **event\_no**  
**Required**  

_최소값: \[1\]_

 | 

이벤트 번호

 |

Delete a storewide promotion

*   [Delete a storewide promotion](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Coupons

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Coupons.png)  
  
쿠폰(Coupons)은 상품의 가격을 할인하거나 배송비를 할인받을 수 있도록 쇼핑몰 회원에게 발급할 수 있는 혜택입니다.  
쿠폰은 쇼핑몰의 판매를 촉진하기 위해 사용할 수 있으며, 다양한 형태로 회원에게 발급할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/coupons
GET /api/v2/admin/coupons/count
POST /api/v2/admin/coupons
PUT /api/v2/admin/coupons/{coupon_no}
```

#### \[더보기 상세 내용\]

### Coupons property list[](#coupons-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| coupon\_no | 

쿠폰번호

 |
| coupon\_type | 

쿠폰유형

쿠폰유형. 온라인 쿠폰과 오프라인 시리얼 쿠폰 유형이 있음.

O : 온라인 쿠폰  
S : 오프라인 시리얼 쿠폰

 |
| coupon\_name | 

쿠폰명

쿠폰의 이름

 |
| coupon\_description | 

쿠폰설명

쿠폰의 설명

 |
| created\_date | 

생성일

쿠폰의 생성 일자

 |
| deleted | 

쿠폰삭제 여부

쿠폰이 삭제되었는지 여부.

 |
| is\_stopped\_issued\_coupon | 

쿠폰 완전삭제 (발급된 쿠폰 사용정지) 여부

쿠폰이 완전 삭제되었는지 여부. 쿠폰이 완전 삭제되면 기존에 발급된 쿠폰도 더 이상 사용이 불가함.

T : 완전삭제  
F : 완전삭제 아님

 |
| pause\_begin\_datetime | 

쿠폰 발급 일시정지 시작시간

쿠폰 발급을 조건부 자동발급으로 설정한 경우, 조건에 해당해도 발급을 일시정지하는 기간의 시작 시간

 |
| pause\_end\_datetime | 

쿠폰 발급 일시정지 종료시간

쿠폰 발급을 조건부 자동발급으로 설정한 경우, 조건에 해당해도 발급을 일시정지하는 기간의 종료 시간

 |
| benefit\_text | 

쿠폰혜택 상세내역 출력

쿠폰혜택의 상세 내역이 출력됨.

 |
| benefit\_type | 

혜택 구분

혜택의 유형. 각각의 유형별로 부여하는 혜택이 다름.

 |
| benefit\_price | 

혜택 금액

혜택으로 할인받는 금액

 |
| benefit\_percentage | 

혜택 비율

혜택으로 할인받는 비율

 |
| benefit\_percentage\_round\_unit | 

혜택 비율 절사 단위

혜택으로 할인받는 금액의 절사 단위

 |
| benefit\_percentage\_max\_price | 

혜택 비율 최대 금액

혜택으로 할인받을 수 있는 최대 금액

 |
| include\_regional\_shipping\_rate | 

배송비 할인 시 지역별 구분 포함 여부

배송비를 할인할 때 지역별 배송비를 포함할지 여부

 |
| include\_foreign\_delivery | 

해외배송 포함여부

쿠폰혜택에 해외배송을 포함할지 여부

 |
| coupon\_direct\_url | 

쿠폰 직접 접근 경로

쿠폰에 직접 접근할 수 있는 경로

 |
| issue\_type | 

발급 구분

쿠폰의 발급형태 유형

 |
| issue\_sub\_type | 

발급 하위 유형

쿠폰 발급의 세부 하위 유형

 |
| issue\_member\_join | 

회원가입시 쿠폰 발급 여부

회원가입 시 발급해주는 쿠폰인지 여부

 |
| issue\_member\_join\_recommend | 

회원가입시 추천인에게 쿠폰 발급 여부

회원가입시 추천인에게 발급해주는 쿠폰인지 여부

 |
| issue\_member\_join\_type | 

회원가입시 쿠폰 발급 대상

회원가입시 쿠폰을 발급해줄 대상에 대한 구분

 |
| issue\_order\_amount\_type | 

발급가능 구매금액 유형

쿠폰으로 할인 시 할인 대상이 되는 금액의 기준

 |
| issue\_order\_start\_date | 

쿠폰발급 가능한 주문시작일시

 |
| issue\_order\_end\_date | 

쿠폰발급 가능한 주문종료일시

 |
| issue\_order\_amount\_limit | 

발급 가능 구매 금액 제한 유형

쿠폰 발급 가능 구매금액을 제한할 수 있음

 |
| issue\_order\_amount\_min | 

발급 가능 최소 구매 금액

쿠폰 발급이 가능한 최소 구매 금액

 |
| issue\_order\_amount\_max | 

발급 가능 최대 구매 금액

쿠폰 발급이 가능한 최대 구매 금액

 |
| issue\_order\_path | 

주문경로

발급한 쿠폰의 사용 가능한 주문 경로

W : 웹 쇼핑몰 전용  
M : 모바일 쇼핑몰 전용  
P : 플러스앱 전용

 |
| issue\_order\_type | 

발급단위

쿠폰 발급 단위

 |
| issue\_order\_available\_product | 

발급 대상 상품

쿠폰 발급 대상이 되는 상품

 |
| issue\_order\_available\_product\_list | 

발급 대상 상품 리스트

 |
| issue\_order\_available\_category | 

발급 대상 카테고리

쿠폰 발급 대상이 되는 카테고리

 |
| issue\_order\_available\_category\_list | 

발급 대상 카테고리 리스트

 |
| issue\_anniversary\_type | 

발급 조건 기념일 유형

쿠폰 발급 조건 기념일의 유형

 |
| issue\_anniversary\_pre\_issue\_day | 

발급 조건 기념일 선발행 일수

기념일 쿠폰 미리 발급 가능한 일수

 |
| issue\_module\_type | 

발급 조건 설치 모듈 유형

모듈 설치 발급 쿠폰의 설치 모듈 유형

S : 바로가기  
B : 즐겨찾기  
L : 라이브링콘

 |
| issue\_review\_count | 

발급 조건 상품 후기 개수

쿠폰 발급에 필요한 상품 후기의 개수

 |
| issue\_review\_has\_image | 

발급 조건 상품 후기 이미지 포함 여부

쿠폰 발급에 필요한 상품 후기에 이미지가 포함되어야 하는지 여부

 |
| issue\_quantity\_min | 

쿠폰 발급가능 최소구매수량

쿠폰 발급이 가능한 최소 구매 수량

 |
| issue\_quntity\_type | 

쿠폰 발급가능수량 판단기준

쿠폰 발급가능수량의 판단이 되는 기준

 |
| issue\_max\_count | 

최대 발급수

쿠폰의 최대 발급수량

 |
| issue\_max\_count\_by\_user | 

동일인 재발급 최대수량

동일한 고객에게 재발급할 수 있는 최대 쿠폰 수량

 |
| issue\_count\_per\_once | 

쿠폰발급 회당 발급수량 (1회 발급수량)

1회 발급할때의 쿠폰 발급수량

 |
| issued\_count | 

발급된 수량

쿠폰이 발급된 수량

 |
| issue\_member\_group\_no | 

발급대상 회원등급 번호

쿠폰발급 대상이 되는 회원등급의 번호

 |
| issue\_member\_group\_name | 

발급대상 회원등급 이름

쿠폰발급 대상이 되는 회원등급의 이름

 |
| issue\_no\_purchase\_period | 

일정기간 미구매 대상 회원의 미구매 기간

일정 기간 미구매 회원 대상 발급시 발급 조건으로 설정한 구매이력이 없는 기간

 |
| issue\_reserved | 

자동 발행 예약 사용 여부

쿠폰 발급일자를 미리 예약하는 기능의 사용여부. 해당 예약 일시가 되면 쿠폰은 자동 발행 됨.

 |
| issue\_reserved\_date | 

자동 발행 예약 발급 일시

설정된 쿠폰 자동 발행 예약 일시

 |
| available\_date | 

쿠폰 사용기간

쿠폰의 사용 가능한 기간

 |
| available\_period\_type | 

사용기간 유형

쿠폰의 사용 가능한 기간의 유형

 |
| available\_begin\_datetime | 

사용 기간 시작 일시

쿠폰 사용 가능 기간 시작일시

 |
| available\_end\_datetime | 

사용 기간 종료 일시

쿠폰 사용 가능 기간 종료일시

 |
| **available\_site**  
**Required** | 

사용 범위 유형

쿠폰 사용 가능한 접속경로의 유형

 |
| available\_scope | 

적용 범위

쿠폰 적용 가능한 범위. 상품 쿠폰으로 적용시 상품 하나에 대하여 쿠폰이 적용되며, 주문서 쿠폰으로 적용시 주문서 전체에 적용됨.

 |
| available\_day\_from\_issued | 

사용 가능 일수

쿠폰의 사용 가능 일수

 |
| available\_price\_type | 

사용가능 구매 금액 유형

쿠폰의 사용가능 금액에 대한 기준. 상품 금액 기준일 경우 상품 가격에 수량을 곱한 금액을 기준으로 하며, 주문 금액 기준일 경우 해당 금액에 기타 할인, 배송비가 적용된 금액을 기준으로 계산한다.

U : 제한 없음  
O : 주문 금액 기준  
P : 상품 금액 기준

 |
| available\_order\_price\_type | 

사용가능 구매 금액 상세 유형

U : 모든 상품의 주문 금액  
I : 쿠폰 적용 상품의 주문 금액

 |
| available\_min\_price | 

사용가능 구매 금액

쿠폰을 사용가능한 구매 금액

 |
| available\_amount\_type | 

적용 계산 기준

쿠폰을 적용할 기준이 되는 결제 금액. 쿠폰할인을 각종 할인(회원등급할인, 상품할인 등)전 주문금액에 적용할지, 각종 할인 후 금액에 적용할지 여부.

 |
| available\_payment\_method | 

사용가능 결제수단

쿠폰 사용이 가능한 결제수단

 |
| available\_product | 

쿠폰적용 상품 선택

쿠폰의 적용가능 상품 선택. 특정 상품을 제외하거나, 적용하거나 혹은 모든 상품에 대해서 쿠폰적용 여부를 선택할 수 있음.

 |
| available\_product\_list | 

쿠폰적용 상품 리스트

 |
| available\_category | 

쿠폰적용 분류 선택

쿠폰의 적용가능 분류 선택. 특정 분류를 제외하거나, 적용하거나 혹은 모든 분류에 대해서 쿠폰적용 여부를 선택할 수 있음.

 |
| available\_category\_list | 

쿠폰적용 분류 리스트

 |
| available\_coupon\_count\_by\_order | 

주문서 당 동일쿠폰 최대 사용 수

한 주문서 당 동일한 쿠폰 최대 사용가능 수

 |
| serial\_generate\_method | 

시리얼 쿠폰 생성방법

시리얼 쿠폰을 생성하는 방법

A : 자동 생성  
M : 직접 등록  
E : 엑셀 업로드

 |
| coupon\_image\_type | 

쿠폰 이미지 유형

쿠폰 이미지의 유형

B : 기본 이미지 사용  
C : 직접 업로드

 |
| coupon\_image\_path | 

쿠폰 이미지 경로

쿠폰 이미지의 URL 경로

 |
| show\_product\_detail | 

상품상세페이지 노출여부

상품상세페이지에 노출할지 여부

 |
| use\_notification\_when\_login | 

로그인 시 쿠폰발급 알람 사용여부

회원 로그인 시 쿠폰발급 알람을 사용할지 여부

 |
| send\_sms\_for\_issue | 

쿠폰발급 SMS 발송 여부

쿠폰 발급정보를 SMS로 발송할지 여부

 |
| send\_email\_for\_issue | 

쿠폰 발급정보 이메일 발송여부

쿠폰 발급정보를 이메일로 발송할지 여부

 |
| recurring\_issuance\_interval | 

정기쿠폰 발급 단위

 |
| recurring\_issuance\_day | 

정기쿠폰 발급 일자

 |
| recurring\_issuance\_hour | 

정기쿠폰 발급 시간

 |
| recurring\_issuance\_minute | 

정기쿠폰 발급 분

 |
| issue\_limit | 

발급수 제한여부

 |
| same\_user\_reissue | 

동일인 재발급 가능여부

 |
| issue\_order\_date | 

발급대상 주문기간 설정

T : 주문기간 설정  
F : 주문기간 설정 불가

 |
| exclude\_unsubscribed | 

이메일 수신거부 회원 제외여부

 |
| discount\_amount | 

할인금액

 |
| discount\_rate | 

할인율

 |
| issue\_on\_anniversary | 

당일 발급 여부

 |
| recurring\_issuance | 

정기쿠폰 발급

 |
| status | 

쿠폰 상태 변경

 |
| immediate\_issue\_pause | 

즉시 발급 중지

 |
| immediate\_issue\_restart | 

즉시 발급 재개

 |

### Retrieve a list of coupons [](#retrieve-a-list-of-coupons)cafe24

GET /api/v2/admin/coupons

###### GET

쇼핑몰에 생성된 쿠폰을 목록으로 조회합니다.  
쿠폰번호, 혜택 구분, 적용 범위등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| coupon\_no | 

쿠폰번호

 |
| coupon\_type | 

쿠폰유형

O : 온라인 쿠폰  
S : 오프라인 시리얼 쿠폰

 |
| coupon\_name | 

쿠폰명

 |
| benefit\_type | 

혜택 구분

쿠폰으로 받는 혜택의 종류 구분

,(콤마)로 여러 건을 검색할 수 있다.

A : 할인금액  
B : 할인율  
C : 적립금액  
D : 적립율  
E : 기본배송비 할인(전액할인)  
I : 기본배송비 할인(할인율)  
H : 기본배송비 할인(할인금액)  
J : 전체배송비 할인(전액할인)  
F : 즉시적립  
G : 예치금

 |
| issue\_type | 

발급 구분

쿠폰의 발급형태 유형

,(콤마)로 여러 건을 검색할 수 있다.

M : 대상자 지정 발급  
A : 조건부 자동 발급  
D : 고객 다운로드 발급  
R : 정기 자동 발급

 |
| issue\_sub\_type | 

발급 하위 유형

쿠폰 발급의 세부 하위 유형

M : 회원 대상  
C : 실시간 접속자 대상  
T : 전체 회원 대상  
J : 회원 가입  
D : 배송 완료 시  
A : 기념일(생일)  
I : 모듈(프로그램) 설치  
P : 상품 후기 작성  
O : 주문 완료 시  
Q : 구매 수량 충족 시  
F : 첫 구매 고객  
N : 일정기간 미구매 회원 대상  
U : 회원등급 상향시

 |
| issued\_flag | 

발급된 쿠폰 여부

쿠폰이 기존에 발급된 이력이 있는지 여부

T : 발급이력이 있는 쿠폰  
F : 발급이력이 없는 쿠폰

 |
| created\_start\_date  

_날짜_

 | 

검색 시작일

쿠폰 생성일 기준 검색의 검색 시작일  
검색 종료일과 같이 사용해야함.

 |
| created\_end\_date  

_날짜_

 | 

검색 종료일

쿠폰 생성일 기준 검색의 검색 종료일  
검색 시작일과 같이 사용해야함.

 |
| deleted | 

쿠폰삭제 여부

쿠폰이 삭제되었는지 여부.

,(콤마)로 여러 건을 검색할 수 있다.

T : 삭제된 쿠폰  
F : 삭제되지 않은 쿠폰

DEFAULT F

 |
| pause\_begin\_date  

_날짜_

 | 

쿠폰 발급 일시정지 시작시간

쿠폰 일시정지일 기준 검색의 검색 시작일

 |
| pause\_end\_date  

_날짜_

 | 

쿠폰 발급 일시정지 종료시간

쿠폰 일시정지일 기준 검색의 검색 종료일

 |
| issue\_order\_path | 

주문경로

발급한 쿠폰의 사용 가능한 주문 경로

W : PC  
M : 모바일  
P : 플러스앱

 |
| issue\_order\_type | 

발급단위

쿠폰의 발급 단위가 상품인지 주문서단위 쿠폰인지 여부

P : 상품 쿠폰  
O : 주문서 쿠폰

 |
| issue\_reserved | 

자동 발행 예약 사용 여부

쿠폰의 자동발행예약 사용여부

T : 사용  
F : 사용하지 않음

 |
| available\_period\_type | 

사용기간 유형

쿠폰 사용기간의 유형

,(콤마)로 여러 건을 검색할 수 있다.

F : 일반 기간  
R : 쿠폰 발급일 기준  
M : 당월 말까지 사용

 |
| available\_datetime  

_날짜_

 | 

해당 날짜에 발급 가능한 쿠폰 검색

해당하는 날짜에 발급 가능한 쿠폰 검색

available\_period\_type이 F일 때만 유효

 |
| available\_site | 

사용 범위 유형

발급한 쿠폰의 사용 가능한 주문 경로

W : 웹 쇼핑몰 전용  
M : 모바일 쇼핑몰 전용  
P : 플러스앱 전용

 |
| available\_scope | 

적용 범위

쿠폰의 적용 가능한 범위가 상품인지 주문서단위 쿠폰인지 여부

P : 상품 쿠폰  
O : 주문서 쿠폰

 |
| available\_price\_type | 

사용가능 구매 금액 유형

쿠폰이 사용 가능한 금액 기준이 주문 금액 기준인지 상품 금액 기준인지 제한이 없는지 여부

U : 제한 없음  
O : 주문 금액 기준  
P : 상품 금액 기준

 |
| available\_order\_price\_type | 

사용가능 구매 금액 상세 유형

U : 모든 상품의 주문 금액  
I : 쿠폰 적용 상품의 주문 금액

 |
| limit  

_최소: \[1\]~최대: \[500\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 100

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a list of coupons

*   [Retrieve a list of coupons](#none)
*   [Retrieve coupons with fields parameter](#none)
*   [Retrieve a specific coupons with coupon\_no parameter](#none)
*   [Retrieve coupons using paging](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of coupons [](#retrieve-a-count-of-coupons)cafe24

GET /api/v2/admin/coupons/count

###### GET

쇼핑몰에 생성된 쿠폰의 수를 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| coupon\_no | 

쿠폰번호

 |
| coupon\_type | 

쿠폰유형

조회할 쿠폰의 유형

O : 온라인 쿠폰  
S : 오프라인 시리얼 쿠폰

 |
| coupon\_name | 

쿠폰명

 |
| benefit\_type | 

혜택 구분

쿠폰으로 받는 혜택의 종류 구분

,(콤마)로 여러 건을 검색할 수 있다.

A : 할인금액  
B : 할인율  
C : 적립금액  
D : 적립율  
E : 기본배송비 할인(전액할인)  
I : 기본배송비 할인(할인율)  
H : 기본배송비 할인(할인금액)  
J : 전체배송비 할인(전액할인)  
F : 즉시적립  
G : 예치금

 |
| issue\_type | 

발급 구분

쿠폰의 발급형태 유형

,(콤마)로 여러 건을 검색할 수 있다.

M : 대상자 지정 발급  
A : 조건부 자동 발급  
D : 고객 다운로드 발급  
R : 정기 자동 발급

 |
| issue\_sub\_type | 

발급 하위 유형

쿠폰 발급의 세부 하위 유형

M : 회원 대상  
C : 실시간 접속자 대상  
T : 전체 회원 대상  
J : 회원 가입  
D : 배송 완료 시  
A : 기념일(생일)  
I : 모듈(프로그램) 설치  
P : 상품 후기 작성  
O : 주문 완료 시  
Q : 구매 수량 충족 시  
F : 첫 구매 고객  
N : 일정기간 미구매 회원 대상  
U : 회원등급 상향시

 |
| issued\_flag | 

발급된 쿠폰 여부

쿠폰이 기존에 발급된 이력이 있는지 여부

T : 발급이력이 있는 쿠폰  
F : 발급이력이 없는 쿠폰

 |
| created\_start\_date  

_날짜_

 | 

검색 시작일

쿠폰 생성일 기준 검색의 검색 시작일  
검색 종료일과 같이 사용해야함.

 |
| created\_end\_date  

_날짜_

 | 

검색 종료일

쿠폰 생성일 기준 검색의 검색 종료일  
검색 시작일과 같이 사용해야함.

 |
| deleted | 

쿠폰삭제 여부

쿠폰이 삭제되었는지 여부.

,(콤마)로 여러 건을 검색할 수 있다.

T : 삭제된 쿠폰  
F : 삭제되지 않은 쿠폰

DEFAULT F

 |
| pause\_begin\_date  

_날짜_

 | 

쿠폰 발급 일시정지 시작시간

쿠폰 발급이 일시정지 되기 시작한 시간.

 |
| pause\_end\_date  

_날짜_

 | 

쿠폰 발급 일시정지 종료시간

쿠폰 발급의 일시정지가 종료된 시간.

 |
| issue\_order\_path | 

주문경로

발급한 쿠폰의 사용 가능한 주문 경로

W : PC  
M : 모바일  
P : 플러스앱

 |
| issue\_order\_type | 

발급단위

P : 상품 쿠폰  
O : 주문서 쿠폰

 |
| issue\_reserved | 

자동 발행 예약 사용 여부

T : 사용  
F : 사용하지 않음

 |
| available\_period\_type | 

사용기간 유형

쿠폰 사용기간의 유형

,(콤마)로 여러 건을 검색할 수 있다.

F : 일반 기간  
R : 쿠폰 발급일 기준  
M : 당월 말까지 사용

 |
| available\_datetime  

_날짜_

 | 

해당 날짜에 발급 가능한 쿠폰 검색

해당하는 날짜에 발급 가능한 쿠폰 검색

available\_period\_type이 F일 때만 유효

 |
| available\_site | 

사용 범위 유형

발급한 쿠폰의 사용 가능한 주문 경로

W : 웹 쇼핑몰 전용  
M : 모바일 쇼핑몰 전용  
P : 플러스앱 전용

 |
| available\_scope | 

적용 범위

쿠폰의 적용 가능한 범위가 상품인지 주문서단위 쿠폰인지 여부

P : 상품 쿠폰  
O : 주문서 쿠폰

 |
| available\_price\_type | 

사용가능 구매 금액 유형

쿠폰이 사용 가능한 금액 기준이 주문 금액 기준인지 상품 금액 기준인지 제한이 없는지 여부

U : 제한 없음  
O : 주문 금액 기준  
P : 상품 금액 기준

 |
| available\_order\_price\_type | 

사용가능 구매 금액 상세 유형

U : 모든 상품의 주문 금액  
I : 쿠폰 적용 상품의 주문 금액

 |

Retrieve a count of coupons

*   [Retrieve a count of coupons](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a coupon [](#create-a-coupon)cafe24

POST /api/v2/admin/coupons

###### POST

쇼핑몰에서 사용할 쿠폰을 발행할 수 있습니다.  
쿠폰명, 혜택 구분, 적용 범위등을 지정하여 발행 가능합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **coupon\_name**  
**Required**  

_글자수 최소: \[1자\]~최대: \[50자\]_

 | 

쿠폰명

 |
| **benefit\_type**  
**Required** | 

혜택 구분

A : 할인금액  
B : 할인율  
C : 적립금액  
D : 적립율  
E : 기본배송비 할인(전액할인)  
I : 기본배송비 할인(할인율)  
H : 기본배송비 할인(할인금액)  
J : 전체배송비 할인(전액할인)  
F : 즉시적립

 |
| **issue\_type**  
**Required** | 

발급 구분

M : 대상자 지정 발급  
A : 조건부 자동 발급  
D : 고객 다운로드 발급  
R : 정기자동발급

 |
| issue\_sub\_type | 

발급 하위 유형

J : 회원 가입  
D : 배송 완료 시  
A : 기념일(생일)  
P : 상품후기 작성  
O : 주문 완료 시  
F : 첫 구매 고객  
Q : 구매 수량 충족 시  
M : 회원대상  
N : 일정기간 미구매 회원 대상  
T : 전체회원대상

 |
| **available\_period\_type**  
**Required** | 

사용기간 유형

F : 일반 기간  
R : 쿠폰 발급일 기준  
M : 당월 말까지 사용

 |
| **available\_site**  
**Required** | 

사용 범위 유형

W : 웹 쇼핑몰 전용  
M : 모바일 쇼핑몰 전용  
P : 플러스앱 전용

 |
| available\_scope | 

적용 범위

P : 상품 쿠폰  
O : 주문서 쿠폰

DEFAULT O

 |
| available\_product | 

쿠폰적용 상품 선택

U : 제한 없음  
I : 선택 상품 적용  
E : 선택 상품 제외

DEFAULT U

 |
| available\_category | 

쿠폰적용 분류 선택

U : 제한 없음  
I : 선택 카테고리 적용  
E : 선택 카테고리 제외

DEFAULT U

 |
| available\_amount\_type | 

적용 계산 기준

E : 할인(쿠폰 제외) 적용 전 결제 금액  
I : 할인(쿠폰 제외) 적용 후 결제 금액

DEFAULT E

 |
| **available\_coupon\_count\_by\_order**  
**Required**  

_최소값: \[1\]_  
_최대값: \[999\]_

 | 

주문서 당 동일쿠폰 최대 사용 수

 |
| available\_begin\_datetime  

_날짜_

 | 

사용 기간 시작 일시

available\_period\_type이 'F'로 입력된 경우만 필수 입력

 |
| available\_end\_datetime  

_날짜_

 | 

사용 기간 종료 일시

available\_period\_type이 'F'로 입력된 경우만 필수 입력

 |
| available\_day\_from\_issued  

_최소값: \[1\]_  
_최대값: \[999\]_

 | 

사용 가능 일수

available\_period\_type이 'R'로 입력된 경우만 필수 입력

 |
| issue\_member\_join | 

회원가입시 쿠폰 발급 여부

T : 발급 대상  
F : 발급 대상 아님

 |
| issue\_member\_join\_recommend | 

회원가입시 추천인에게 쿠폰 발급 여부

T : 발급 대상  
F : 발급 대상 아님

 |
| issue\_member\_join\_type | 

회원가입시 쿠폰 발급 대상

A : SMS 수신동의 AND 이메일 수신동의  
O : SMS 수신동의 OR 이메일 수신동의  
S : SMS 수신동의  
E : 이메일 수신동의  
N : 제한없음

 |
| issue\_anniversary\_type | 

발급 조건 기념일 유형

B : 생일  
W : 결혼 기념일

 |
| issue\_on\_anniversary | 

당일 발급 여부

S : 당일  
P: 선발행

 |
| issue\_anniversary\_pre\_issue\_day  

_최소값: \[0\]_  
_최대값: \[365\]_

 | 

발급 조건 기념일 선발행 일수

issue\_on\_anniversary가 'P'로 입력된 경우만 필수 입력

 |
| issue\_review\_count  

_최소값: \[1\]_

 | 

발급 조건 상품 후기 개수

issue\_sub\_type가'P'으로입력된경우만필수입력

 |
| issue\_review\_has\_image | 

발급 조건 상품 후기 이미지 포함 여부

T : 포함  
F : 미포함

 |
| issue\_limit | 

발급수 제한여부

T : 발급 제한  
F : 발급 제한 아님

 |
| same\_user\_reissue | 

동일인 재발급 가능여부

issue\_limit가 'T'로 입력된 경우만 필수 입력

T : 동일인 재발급 가능  
F : 동일인 재발급 불가능

 |
| issue\_reserved | 

자동 발행 예약 사용 여부

T : 자동 발행 예약 사용  
F : 자동 발행 예약 미사용

DEFAULT F

 |
| issue\_reserved\_date  

_날짜_

 | 

자동 발행 예약 발급 일시

issue\_reserved가 'T'로 입력된 경우만 필수 입력

 |
| issue\_no\_purchase\_period  

_최소값: \[1\]_  
_최대값: \[12\]_

 | 

일정기간 미구매 대상 회원의 미구매 기간

1-12까지정수형으로입력

 |
| show\_product\_detail | 

상품상세페이지 노출여부

T : 상품상세페이지 노출  
F : 상품상세페이지 미노출

 |
| include\_regional\_shipping\_rate | 

배송비 할인 시 지역별 구분 포함 여부

T : 지역별 구분 포함  
F : 지역별 구분 미포함

 |
| include\_foreign\_delivery | 

해외배송 포함여부

T : 해외배송 포함  
F : 해외배송 미포함

 |
| available\_product\_list | 

쿠폰적용 상품 리스트

 |
| available\_category\_list | 

쿠폰적용 분류 리스트

 |
| available\_price\_type | 

사용가능 구매 금액 유형

U : 제한 없음  
O : 주문 금액 기준  
P : 상품 금액 기준

DEFAULT U

 |
| available\_order\_price\_type | 

사용가능 구매 금액 상세 유형

U : 모든 상품의 주문 금액  
I : 쿠폰 적용 상품의 주문 금액

 |
| available\_min\_price  

_최소: \[0.01\]~최대: \[999999999\]_

 | 

사용가능 구매 금액

 |
| issue\_max\_count  

_최소값: \[1\]_  
_최대값: \[999\]_

 | 

최대 발급수

 |
| issue\_max\_count\_by\_user  

_최소값: \[0\]_  
_최대값: \[999\]_

 | 

동일인 재발급 최대수량

 |
| issue\_order\_path | 

주문경로

W : 웹 쇼핑몰 전용  
M : 모바일 쇼핑몰 전용  
P : 플러스앱 전용

 |
| issue\_order\_date | 

발급대상 주문기간 설정

T : 주문기간 설정  
F : 주문기간 설정 불가

 |
| issue\_order\_start\_date  

_날짜_

 | 

쿠폰발급 가능한 주문시작일시

 |
| issue\_order\_end\_date  

_날짜_

 | 

쿠폰발급 가능한 주문종료일시

 |
| issue\_member\_group\_no | 

발급대상 회원등급 번호

 |
| issue\_member\_group\_name | 

발급대상 회원등급 이름

 |
| discount\_amount | 

할인금액

 |
| 

discount\_amount 하위 요소 보기

**benefit\_price**  
**Required**  
혜택 금액







 |
| discount\_rate | 

할인율

 |
| 

discount\_rate 하위 요소 보기

**benefit\_percentage**  
**Required**  
혜택 비율

**benefit\_percentage\_round\_unit**  
**Required**  
혜택 비율 절사 단위

**benefit\_percentage\_max\_price**  
**Required**  
혜택 비율 최대 금액







 |
| issue\_order\_amount\_type | 

발급가능 구매금액 유형

O : 구매금액 기준  
S : 실결제 금액기준

 |
| issue\_order\_amount\_limit | 

발급 가능 구매 금액 제한 유형

U : 제한 없음  
L : 최소 금액  
S : 금액 범위

 |
| issue\_order\_amount\_min  

_최소: \[0.01\]~최대: \[999999999\]_

 | 

발급 가능 최소 구매 금액

 |
| issue\_order\_amount\_max  

_최소: \[0.01\]~최대: \[999999999\]_

 | 

발급 가능 최대 구매 금액

 |
| issue\_count\_per\_once  

_최소값: \[1\]_  
_최대값: \[10\]_

 | 

쿠폰발급 회당 발급수량 (1회 발급수량)

 |
| issue\_order\_type | 

발급단위

O : 주문서단위 발급쿠폰  
P : 상품단위 발급쿠폰

 |
| issue\_order\_available\_product | 

발급 대상 상품

U : 제한 없음  
I : 선택 상품 적용  
E : 선택 상품 제외

 |
| issue\_order\_available\_product\_list | 

발급 대상 상품 리스트

 |
| issue\_order\_available\_category | 

발급 대상 카테고리

U : 제한 없음  
I : 선택 카테고리 적용  
E : 선택 카테고리 제외

 |
| issue\_order\_available\_category\_list | 

발급 대상 카테고리 리스트

 |
| issue\_quntity\_type | 

쿠폰 발급가능수량 판단기준

P : 상품 수량 기준  
O : 주문 수량 기준

 |
| issue\_quantity\_min  

_최소값: \[1\]_  
_최대값: \[999\]_

 | 

쿠폰 발급가능 최소구매수량

 |
| available\_payment\_method | 

사용가능 결제수단

all : 제한없음  
R : 무통장입금  
E : 가상계좌  
C : 신용카드  
A : 계좌이체  
H : 휴대폰  
M : 적립금  
K : 케이페이  
P : 페이나우  
N : 페이코  
O : 카카오페이  
S : 스마일페이  
V : 네이버페이  
B : 편의점  
D : 토스

 |
| use\_notification\_when\_login | 

로그인 시 쿠폰발급 알람 사용여부

T : 알람 사용  
F : 알람 미사용

 |
| send\_sms\_for\_issue | 

쿠폰발급 SMS 발송 여부

T : SMS 발송  
F : SMS 미발송

 |
| send\_email\_for\_issue | 

쿠폰 발급정보 이메일 발송여부

T : 이메일 발송  
F : 이메일 미발송

 |
| exclude\_unsubscribed | 

이메일 수신거부 회원 제외여부

T : 이메일 수신거부 회원 제외  
F : 이메일 수신거부 회원 미제외

 |
| recurring\_issuance | 

정기쿠폰 발급

 |
| 

recurring\_issuance 하위 요소 보기

**recurring\_issuance\_interval**  
**Required**  
정기쿠폰 발급 단위  
1m : 1개월  
3m : 3개월  
6m : 6개월  
12m : 12개월

**recurring\_issuance\_day**  
**Required**  
정기쿠폰 발급 일자  
1 : 1일  
5 : 5일  
10 : 10일  
15 : 15일  
20 : 20일  
25 : 25일

**recurring\_issuance\_hour**  
**Required**  
정기쿠폰 발급 시간  
08 : 08시  
09 : 09시  
10 : 10시  
11 : 11시  
12 : 12시  
13 : 13시  
14 : 14시  
15 : 15시  
16 : 16시  
17 : 17시  
18 : 18시  
19 : 19시  
20 : 20시  
21 : 21시  
22 : 22시  
23 : 23시

**recurring\_issuance\_minute**  
**Required**  
정기쿠폰 발급 분  
00 : 00분  
05 : 05분  
10 : 10분  
15 : 15분  
20 : 20분  
25 : 25분  
30 : 30분  
35 : 35분  
40 : 40분  
45 : 45분  
50 : 50분  
55 : 55분







 |

Create a coupon

*   [Create a coupon](#none)
*   [Create a coupon by using only required fields](#none)
*   [Try creating a coupon without discount\_rate field when benefit type is discount rate](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Coupon management [](#coupon-management)cafe24

PUT /api/v2/admin/coupons/{coupon\_no}

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **coupon\_no**  
**Required** | 

쿠폰번호

 |
| status | 

쿠폰 상태 변경

쿠폰을 삭제하는 경우, null로 전송

발급 중지: pause  
발급 재개: restart

 |
| deleted | 

쿠폰삭제 여부

D : 삭제

 |
| immediate\_issue\_pause | 

즉시 발급 중지

I 입력 시 status 항목을 pause 로 전송 필요

I : 즉시 발급 중지

 |
| immediate\_issue\_restart | 

즉시 발급 재개

I 입력 시 status 항목을 restart 로 전송 필요

I : 즉시 발급 재개

 |

Coupon management

*   [Coupon management](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Coupons issuancecustomers

> Endpoints

```
GET /api/v2/admin/coupons/{coupon_no}/issuancecustomers
```

#### \[더보기 상세 내용\]

### Coupons issuancecustomers property list[](#coupons__issuancecustomers-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| coupon\_no | 

쿠폰번호

 |
| member\_id | 

회원아이디

 |
| group\_no | 

발급대상 회원등급 번호

 |
| issued\_date | 

쿠폰 발급일자

 |
| expiration\_date | 

만료일

 |
| used\_coupon | 

쿠폰사용 여부

 |
| used\_date | 

쿠폰 사용 일자

 |
| related\_order\_id | 

관련 주문번호

 |

### Retrieve a list of eligible customers for conditional issuance [](#retrieve-a-list-of-eligible-customers-for-conditional-issuance)cafe24

GET /api/v2/admin/coupons/{coupon\_no}/issuancecustomers

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **coupon\_no**  
**Required** | 

쿠폰번호

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| group\_no | 

회원등급번호

 |
| since\_member\_id  

_최대글자수 : \[20자\]_

 | 

해당 쿠폰 회원 ID 이후 검색

 |
| limit  

_최소: \[1\]~최대: \[500\]_

 | 

조회결과 최대건수

DEFAULT 10

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a list of eligible customers for conditional issuance

*   [Retrieve a list of eligible customers for conditional issuance](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Coupons issues

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Coupons%20issues.png)  
  
쿠폰 발급(Coupons issues)은 생성된 쿠폰에 관한 기능입니다.  
쿠폰 발급은 하위 리소스로 쿠폰(Coupons) 하위에서만 사용할 수 있습니다.  
생성된 쿠폰에 대한 발급, 발급한 쿠폰에 대한 조회가 가능합니다.

> Endpoints

```
GET /api/v2/admin/coupons/{coupon_no}/issues
POST /api/v2/admin/coupons/{coupon_no}/issues
```

#### \[더보기 상세 내용\]

### Coupons issues property list[](#coupons__issues-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| coupon\_no | 

쿠폰번호

 |
| issue\_no | 

쿠폰 발급번호

 |
| member\_id | 

회원아이디

 |
| group\_no | 

발급대상 회원등급 번호

 |
| issued\_date | 

쿠폰 발급일자

 |
| expiration\_date | 

만료일

 |
| used\_coupon | 

쿠폰사용 여부

 |
| used\_date | 

쿠폰 사용 일자

 |
| related\_order\_id | 

관련 주문번호

 |
| count | 

카운트

 |

### Retrieve a list of issued coupons [](#retrieve-a-list-of-issued-coupons)cafe24

GET /api/v2/admin/coupons/{coupon\_no}/issues

###### GET

생성된 쿠폰에 대한 발급내역의 조회가 가능합니다.  
회원아이디, 회원등급번호, 쿠폰사용 여부등을 확인할 수 있습니다.  
offset 최대값인 8000개 이상이 발급된 쿠폰의 내역을 조회하기 위해서는 since\_issue\_no 파라메터를 이용하시면 됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **coupon\_no**  
**Required** | 

쿠폰번호

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| group\_no | 

회원등급번호

 |
| issued\_date  

_날짜_

 | 

쿠폰 발급일자

 |
| issued\_start\_date  

_날짜_

 | 

검색 시작일

 |
| issued\_end\_date  

_날짜_

 | 

검색 종료일

 |
| used\_coupon | 

쿠폰사용 여부

T : 사용함  
F : 사용안함

 |
| since\_issue\_no | 

해당 쿠폰 발급번호 이후 검색

특정 쿠폰발급 이후의 쿠폰을 검색.  
해당 검색조건 사용시 offset과 관계 없이 모든 쿠폰 발급번호를 검색할 수 있다.  
※ 해당 검색 조건 사용시 다음 파라메터로는 사용할 수 없다.  
offset

 |
| limit  

_최소: \[1\]~최대: \[500\]_

 | 

조회결과 최대건수

DEFAULT 10

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a list of issued coupons

*   [Retrieve a list of issued coupons](#none)
*   [Retrieve issued coupons using fields parameter](#none)
*   [Retrieve issued coupons using paging](#none)
*   [Retrieve issued coupons using since\_issue\_no instead of offset to retrieve all issued coupons](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create coupon issuance history [](#create-coupon-issuance-history)cafe24

POST /api/v2/admin/coupons/{coupon\_no}/issues

###### POST

생성된 쿠폰에 대한 발급이 가능합니다.  
쿠폰을 발급하기 위해서는 우선 쿠폰을 먼저 생성해야 합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| shop\_no | 

멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| **coupon\_no**  
**Required** | 

쿠폰번호

 |
| **issued\_member\_scope**  
**Required** | 

회원/조건 선택

쿠폰 발급 대상 회원의 범위를 특정하여 쿠폰을 발급할 수 있음.  
특정회원그룹(G)을 입력할 경우 group\_no를 필수로 입력해야한다.  
특정회원(M)을 입력할 경우 member\_id를 필수로 입력해야한다.

A : 전체 회원  
G : 특정 회원 그룹  
M : 특정 회원

 |
| group\_no | 

회원등급번호

 |
| member\_id | 

회원아이디

 |
| send\_sms\_for\_issue | 

쿠폰발급 SMS 발송 여부

쿠폰 발급정보를 SMS로 발송할지 여부

**EC 일본, 베트남, 필리핀 버전에서는 사용할 수 없음.**

T : 발송함  
F : 발송안함

DEFAULT F

 |
| allow\_duplication | 

중복발급설정

쿠폰의 중복발급설정 여부.

T : 발급함  
F : 발급안함  
S : 발급안함(사용유무  
사용기간 추가검증 안 함)

DEFAULT F

 |
| single\_issue\_per\_once | 

1회 발급시 1장만 발급할지 여부

쿠폰을 발급할 때 1회 발급시 1장만 발급할지 여부

T : 1장씩 발급  
F : 동시발행수량 설정만큼 발급

DEFAULT T

 |
| issue\_count\_per\_once  

_최소값: \[2\]_  
_최대값: \[10\]_

 | 

다수 발행시 발행 수량

쿠폰 1회 발급시 여러장 발행하는 경우 그 수량

DEFAULT 2

 |
| issued\_place\_type | 

발급처 구분

쿠폰이 발행된 출처 구분

W : 웹  
M : 모바일  
P : 플러스앱

 |
| issued\_by\_action\_type | 

앱 설치시 쿠폰 발급

앱 설치시 쿠폰이 발급되는 시점

INSTALLATION : 앱 설치시 쿠폰 발급  
ACCEPTING\_PUSH : 앱 푸시 수신 On시 쿠폰 발급

 |
| issued\_by\_event\_type | 

발급 사유 구분

혜택으로 인한 쿠폰발급 시 해당되는 혜택

C : 출석체크 이벤트  
U : 회원정보 수정 이벤트  
B : 배너수익쉐어프로그램  
R : 룰렛게임(CMC)팀  
Z : 플러스앱설치(플러스앱)  
Y : 푸시알림 ON(플러스앱)  
X : 플러스앱 주문(플러스앱)  
M : 리마인드 Me 주문  
W : 리마인드 Me 리워드  
V : 통합멤버십  
L : 평생회원 전환 이벤트

 |
| request\_admin\_id | 

발급자 ID

 |

Create coupon issuance history

*   [Create coupon issuance history](#none)
*   [Issue a coupon to a certain customer group by using only required fields](#none)
*   [Try issuing a coupon to a certain customer group without using issued\_member\_scope field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Customerevents

회원정보 이벤트관리와 관련하여 SMS 수신동의 유도, 이메일 등록 유도 등 프로모션 연계 및 등록된 이벤트 목록과 실행 여부 파악할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/customerevents
POST /api/v2/admin/customerevents
PUT /api/v2/admin/customerevents
```

#### \[더보기 상세 내용\]

### Customerevents property list[](#customerevents-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| no | 

이벤트 번호

 |
| type | 

이벤트 유형

E: 회원정보수정  
P: 비밀번호변경  
L: 평생회원전환

 |
| name | 

이벤트 이름

 |
| description | 

이벤트 설명

 |
| start\_date | 

이벤트 시작 시간

 |
| end\_date | 

이벤트 종료 시간

 |
| created\_date | 

이벤트 생성일

 |
| items | 

이벤트 항목

zipcode: 새 우편번호 주소  
address: 주소 수정  
cellphone: 휴대폰번호  
password: 비밀번호 수정  
sms: SMS 수신 동의  
email: 이메일 수신 동의

 |
| reward\_condition | 

이벤트 조건

O: 설정한 항목 중 1개 이상 수정한 경우 혜택 지급  
A: 설정한 항목을 모두 수정한 경우 혜택 지급

 |
| agree\_restriction | 

이메일/SMS 수신동의 지급 제한 설정 사용 여부

T: 사용함  
F: 사용안함

 |
| agree\_restriction\_period | 

이메일/SMS 수신동의 변경 불가 기간

1: 1개월  
3: 3개월  
6: 6개월  
12: 12개월  
\-1: 무기한

 |
| auto\_reward | 

혜택 자동 지급 설정 여부

T: 사용함  
F: 사용안함

 |
| use\_point | 

혜택 자동 지급 적립금 사용 여부

T: 사용함  
F: 사용안함

 |
| point\_amount | 

혜택 자동 지급 적립금

 |
| use\_coupon | 

혜택 자동 지급 쿠폰 사용 여부

T: 사용함  
F: 사용안함

 |
| coupon\_no | 

혜택 자동 지급 쿠폰

 |
| popup\_notification | 

평생회원 전환 이벤트 안내 팝업 사용 여부

T: 사용함  
F: 사용안함

 |
| status | 

이벤트 상태

 |

### View member information event [](#view-member-information-event)cafe24

GET /api/v2/admin/customerevents

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| name  

_최대글자수 : \[200자\]_

 | 

이벤트 이름

 |
| search\_date | 

검색 기준일

created\_date: 이벤트 생성일  
start\_date: 이벤트 시작일  
end\_date: 이벤트 종료일

DEFAULT created\_date

 |
| start\_date  

_날짜_

 | 

검색 시작일

 |
| end\_date  

_날짜_

 | 

검색 종료일

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

View member information event

*   [View member information event](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a member information modification event [](#create-a-member-information-modification-event)cafe24

POST /api/v2/admin/customerevents

###### POST

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **type**  
**Required** | 

이벤트 유형

E: 회원정보수정  
P: 비밀번호변경  
L: 평생회원전환

 |
| **name**  
**Required**  

_최대글자수 : \[200자\]_

 | 

이벤트 이름

 |
| description  

_최대글자수 : \[200자\]_

 | 

이벤트 설명

 |
| start\_date  

_날짜_

 | 

이벤트 시작 시간

 |
| end\_date  

_날짜_

 | 

이벤트 종료 시간

 |
| items  

_배열 최대사이즈: \[6\]_

 | 

이벤트 항목

zipcode: 새 우편번호 주소  
address: 주소 수정  
cellphone: 휴대폰번호  
password: 비밀번호 수정  
sms: SMS 수신 동의  
email: 이메일 수신 동의

 |
| reward\_condition | 

이벤트 조건

O: 설정한 항목 중 1개 이상 수정한 경우 혜택 지급  
A: 설정한 항목을 모두 수정한 경우 혜택 지급

 |
| agree\_restriction | 

이메일/SMS 수신동의 지급 제한 설정 사용 여부

T: 사용함  
F: 사용안함

 |
| agree\_restriction\_period | 

이메일/SMS 수신동의 변경 불가 기간

1: 1개월  
3: 3개월  
6: 6개월  
12: 12개월  
\-1: 무기한

 |
| auto\_reward | 

혜택 자동 지급 설정 여부

T: 사용함  
F: 사용안함

 |
| use\_point | 

혜택 자동 지급 적립금 사용 여부

T: 사용함  
F: 사용안함

 |
| point\_amount | 

혜택 자동 지급 적립금

 |
| use\_coupon | 

혜택 자동 지급 쿠폰 사용 여부

T: 사용함  
F: 사용안함

 |
| coupon\_no | 

혜택 자동 지급 쿠폰

 |
| popup\_notification | 

평생회원 전환 이벤트 안내 팝업 사용 여부

T: 사용함  
F: 사용안함

 |

Create a member information modification event

*   [Create a member information modification event](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update information update campaign status [](#update-information-update-campaign-status)cafe24

PUT /api/v2/admin/customerevents

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **no**  
**Required** | 

이벤트 번호

 |
| **status**  
**Required** | 

이벤트 상태

S: 이벤트종료  
D: 이벤트삭제

 |

Update information update campaign status

*   [Update information update campaign status](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Customers coupons

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Customers%20coupons.png)  
  
회원 쿠폰(Customers coupons)은 특정 회원이 보유한 쿠폰에 관한 기능입니다.  
회원에게 발급된 쿠폰을 조회하거나 삭제할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/customers/{member_id}/coupons
GET /api/v2/admin/customers/{member_id}/coupons/count
DELETE /api/v2/admin/customers/{member_id}/coupons/{coupon_no}
```

#### \[더보기 상세 내용\]

### Customers coupons property list[](#customers__coupons-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| coupon\_no | 

쿠폰번호

 |
| issue\_no | 

쿠폰 발급번호

 |
| coupon\_name | 

쿠폰명

 |
| available\_price\_type | 

사용가능 구매 금액 유형

U : 제한 없음  
O : 주문 금액 기준  
P : 상품 금액 기준

 |
| available\_price\_type\_detail | 

사용가능 구매 금액 유형 상세

U : 모든 상품의 주문 금액  
I : 쿠폰 적용 상품의 주문 금액

 |
| available\_min\_price | 

사용가능 구매 금액

 |
| available\_payment\_methods | 

사용가능 결제수단

all : 제한없음  
R : 무통장입금  
E : 가상계좌  
C : 신용카드  
A : 계좌이체  
H : 휴대폰  
M : 적립금  
K : 케이페이  
P : 페이나우  
N : 페이코  
O : 카카오페이  
S : 스마일페이  
V : 네이버페이  
B : 편의점  
D : 토스

 |
| benefit\_type | 

혜택 구분

A : 할인금액  
B : 할인율  
C : 적립금액  
D : 적립율  
E : 기본배송비 할인(전액할인)  
I : 기본배송비 할인(할인율)  
H : 기본배송비 할인(할인금액)  
F : 즉시적립  
G : 예치금

 |
| benefit\_price | 

혜택 금액

 |
| benefit\_percentage | 

혜택 비율

 |
| benefit\_percentage\_round\_unit | 

혜택 비율 절사 단위

 |
| benefit\_percentage\_max\_price | 

혜택 비율 최대 금액

 |
| credit\_amount | 

예치금 지급 금액

 |
| issued\_date | 

발행일

 |
| available\_begin\_datetime | 

사용 기간 시작 일시

 |
| available\_end\_datetime | 

사용 기간 종료 일시

 |

### Retrieve a list of customer coupons [](#retrieve-a-list-of-customer-coupons)cafe24

GET /api/v2/admin/customers/{member\_id}/coupons

###### GET

회��에게 발급된 쿠폰을 목록으로 조회합니다.  
쿠폰번호, 혜택 구분, 적용 범위등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required** | 

회원아이디

 |
| offset  

_최대값: \[10000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve a list of customer coupons

*   [Retrieve a list of customer coupons](#none)
*   [Retrieve coupons with fields parameter](#none)
*   [Retrieve coupons using paging](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of customer coupons [](#retrieve-a-count-of-customer-coupons)cafe24

GET /api/v2/admin/customers/{member\_id}/coupons/count

###### GET

회원에게 발급된 쿠폰의 개수를 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required** | 

회원아이디

 |

Retrieve a count of customer coupons

*   [Retrieve a count of customer coupons](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a customer coupon [](#delete-a-customer-coupon)cafe24

DELETE /api/v2/admin/customers/{member\_id}/coupons/{coupon\_no}

###### DELETE

회원에게 발급된 쿠폰을 삭제합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required** | 

회원아이디

 |
| **coupon\_no**  
**Required** | 

쿠폰번호

 |
| issue\_no | 

쿠폰 발급번호

 |

Delete a customer coupon

*   [Delete a customer coupon](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Discountcodes

할인코드를 관리하는 기능을 제공합니다.

> Endpoints

```
GET /api/v2/admin/discountcodes
GET /api/v2/admin/discountcodes/{discount_code_no}
POST /api/v2/admin/discountcodes
PUT /api/v2/admin/discountcodes/{discount_code_no}
DELETE /api/v2/admin/discountcodes/{discount_code_no}
```

#### \[더보기 상세 내용\]

### Discountcodes property list[](#discountcodes-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| discount\_code\_no | 

할인코드 번호

 |
| discount\_code\_name | 

할인코드 이름

 |
| discount\_code | 

할인코드

 |
| available\_start\_date | 

시작일

 |
| available\_end\_date | 

종료일

 |
| available\_product\_type | 

할인코드 적용범위

할인코드의 적용범위가 A(전체상품) 일 경우 할인코드적용 상품(available\_product) 및 할인코드적용 분류(available\_category) 는 입력 필요 없음  
  
할인코드의 적용범위가 P(특정상품) 일 경우 할인코드적용 상품(available\_product) 은 필수 입력  
할인코드의 적용범위가 C(특정분류) 일 경우 할인코드적용 분류(available\_category)는 필수 입력  
  
A : 전체상품  
P : 특정상품  
C : 특정분류

 |
| created\_date | 

혜택 등록일

 |
| available\_issue\_count | 

최대 발급 횟수

 |
| issued\_count | 

발급된 수량

 |
| discount\_value | 

할인 값

 |
| discount\_truncation\_unit | 

절사 단위

C : 0.01단위  
B : 0.1단위  
F : 절사안함  
O : 1원단위  
T : 10원단위  
M : 100원단위  
H : 1000원 단위

 |
| discount\_max\_price | 

혜택 최대 금액

 |
| available\_product | 

특정상품 리스트

할인코드 적용범위(available\_product\_type)가 P(특정상품) 의 경우 상품번호를 배열로 입력한다.

 |
| available\_category | 

특정분류 리스트

할인코드 적용범위(available\_product\_type)가 C(특정분류) 의 경우 분류번호를 배열로 입력한다.

 |
| available\_min\_price | 

이용 주문 최소 금액

 |
| available\_user | 

사용가능 대상

 |
| max\_usage\_per\_user | 

회원당 사용가능 횟수

 |

### Retrieve a list of discount codes [](#retrieve-a-list-of-discount-codes)cafe24

GET /api/v2/admin/discountcodes

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| discount\_code\_name | 

할인코드 이름

 |
| discount\_code | 

할인코드

 |
| search\_date\_type | 

available\_start\_date : 시작일 available\_end\_date : 종료일 created\_date : 등록일

available\_start\_date : 시작일  
available\_end\_date : 종료일  
created\_date : 등록일

 |
| start\_date  

_날짜_

 | 

검색 시작일

 |
| end\_date  

_날짜_

 | 

검색 종료일

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |
| sort | 

정렬 순서 값

discount\_code\_name : 혜택이름  
discount\_code : 할인코드  
created\_date : 등록시간  
available\_start\_date : 시작시간  
available\_end\_date : 종료시간

DEFAULT created\_date

 |
| order | 

정렬 순서

asc : 순차정렬  
desc : 역순 정렬

DEFAULT desc

 |

Retrieve a list of discount codes

*   [Retrieve a list of discount codes](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a discount code [](#retrieve-a-discount-code)cafe24

GET /api/v2/admin/discountcodes/{discount\_code\_no}

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **discount\_code\_no**  
**Required**  

_최소값: \[1\]_

 | 

할인코드 번호

 |

Retrieve a discount code

*   [Retrieve a discount code](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a discount code [](#create-a-discount-code)cafe24

POST /api/v2/admin/discountcodes

###### POST

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **discount\_code**  
**Required**  

_최소글자수 : \[1자\]_  
_최대글자수 : \[35자\]_

 | 

할인코드

 |
| **discount\_code\_name**  
**Required**  

_글자수 최소: \[1자\]~최대: \[50자\]_

 | 

할인코드 이름

 |
| **discount\_value**  
**Required**  

_최소값: \[1\]_  
_최대값: \[99\]_

 | 

할인 값

 |
| **discount\_truncation\_unit**  
**Required** | 

절사 단위

C : 0.01단위  
B : 0.1단위  
F : 절사안함  
O : 1원단위  
T : 10원단위  
M : 100원단위  
H : 1000원 단위

 |
| **discount\_max\_price**  
**Required**  

_최소값: \[1\]_  
_최대값: \[999999999\]_

 | 

혜택 최대 금액

 |
| **available\_start\_date**  
**Required**  

_날짜_

 | 

시작일

 |
| **available\_end\_date**  
**Required**  

_날짜_

 | 

종료일

 |
| available\_product\_type | 

할인코드 적용범위

할인코드의 적용범위가 A(전체상품) 일 경우 할인코드적용 상품(available\_product) 및 할인코드적용 분류(available\_category) 는 입력 필요 없음  
  
할인코드의 적용범위가 P(특정상품) 일 경우 할인코드적용 상품(available\_product) 은 필수 입력  
할인코드의 적용범위가 C(특정분류) 일 경우 할인코드적용 분류(available\_category)는 필수 입력  
  
A : 전체상품  
P : 특정상품  
C : 특정분류

DEFAULT A

 |
| available\_product | 

특정상품 리스트

할인코드 적용범위(available\_product\_type)가 P(특정상품) 의 경우 상품번호를 배열로 입력한다.

 |
| available\_category | 

특정분류 리스트

할인코드 적용범위(available\_product\_type)가 C(특정분류) 의 경우 분류번호를 배열로 입력한다.

 |
| available\_min\_price  

_최대값: \[999999999\]_

 | 

이용 주문 최소 금액

DEFAULT 0

 |
| available\_issue\_count  

_최대값: \[10000\]_

 | 

최대 발급 횟수

DEFAULT 0

 |
| available\_user | 

사용가능 대상

M : 회원  
A : 전체

DEFAULT A

 |
| max\_usage\_per\_user  

_최대값: \[999\]_

 | 

회원당 사용가능 횟수

DEFAULT 0

 |

Create a discount code

*   [Create a discount code](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a discount code [](#update-a-discount-code)cafe24

PUT /api/v2/admin/discountcodes/{discount\_code\_no}

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **discount\_code\_no**  
**Required**  

_최소값: \[1\]_

 | 

할인코드 번호

 |
| discount\_code  

_최소글자수 : \[1자\]_  
_최대글자수 : \[35자\]_

 | 

할인코드

 |
| **discount\_code\_name**  
**Required**  

_글자수 최소: \[1자\]~최대: \[50자\]_

 | 

할인코드 이름

 |
| discount\_value  

_최소값: \[1\]_  
_최대값: \[99\]_

 | 

할인 값

 |
| discount\_truncation\_unit | 

절사 단위

C : 0.01단위  
B : 0.1단위  
F : 절사안함  
O : 1원단위  
T : 10원단위  
M : 100원단위  
H : 1000원 단위

 |
| discount\_max\_price  

_최소값: \[1\]_  
_최대값: \[999999999\]_

 | 

혜택 최대 금액

 |
| available\_start\_date  

_날짜_

 | 

시작일

 |
| available\_end\_date  

_날짜_

 | 

종료일

 |
| available\_product\_type | 

할인코드 적용범위

할인코드의 적용범위가 A(전체상품) 일 경우 할인코드적용 상품(available\_product) 및 할인코드적용 분류(available\_category) 는 입력 필요 없음  
  
할인코드의 적용범위가 P(특정상품) 일 경우 할인코드적용 상품(available\_product) 은 필수 입력  
할인코드의 적용범위가 C(특정분류) 일 경우 할인코드적용 분류(available\_category)는 필수 입력  
  
A : 전체상품  
P : 특정상품  
C : 특정분류

 |
| available\_product | 

특정상품 리스트

할인코드 적용범위(available\_product\_type)가 P(특정상품) 의 경우 상품번호를 배열로 입력한다.

 |
| available\_category | 

특정분류 리스트

할인코드 적용범위(available\_product\_type)가 C(특정분류) 의 경우 분류번호를 배열로 입력한다.

 |
| available\_min\_price  

_최대값: \[999999999\]_

 | 

이용 주문 최소 금액

 |
| available\_issue\_count  

_최대값: \[10000\]_

 | 

최대 발급 횟수

 |
| available\_user | 

사용가능 대상

M : 회원  
A : 전체

 |
| max\_usage\_per\_user  

_최대값: \[999\]_

 | 

회원당 사용가능 횟수

 |

Update a discount code

*   [Update a discount code](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a discount code [](#delete-a-discount-code)cafe24

DELETE /api/v2/admin/discountcodes/{discount\_code\_no}

###### DELETE

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **discount\_code\_no**  
**Required**  
_최소값: \[1\]_

 | 

할인코드 번호

 |

Delete a discount code

*   [Delete a discount code](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Serialcoupons

시리얼코드로 쿠폰을 관리하는 기능을 제공합니다.

> Endpoints

```
GET /api/v2/admin/serialcoupons
POST /api/v2/admin/serialcoupons
DELETE /api/v2/admin/serialcoupons/{coupon_no}
```

#### \[더보기 상세 내용\]

### Serialcoupons property list[](#serialcoupons-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| coupon\_no | 

쿠폰번호

 |
| coupon\_name | 

쿠폰명

 |
| coupon\_description | 

쿠폰설명

 |
| created\_date | 

생성일

 |
| deleted | 

쿠폰삭제 여부

T : 삭제  
F : 삭제되지 않음

 |
| benefit\_text | 

쿠폰혜택 상세내역 출력

 |
| benefit\_type | 

혜택 구분

A : 할인금액  
B : 할인율

 |
| benefit\_price | 

혜택 금액

 |
| benefit\_percentage | 

혜택 비율

 |
| benefit\_percentage\_round\_unit | 

혜택 비율 절사 단위

 |
| benefit\_percentage\_max\_price | 

혜택 비율 최대 금액

 |
| include\_regional\_shipping\_rate | 

배송비 할인 시 지역별 구분 포함 여부

T : 지역별 구분 포함  
F : 지역별 구분 미포함

 |
| include\_foreign\_delivery | 

해외배송 포함여부

T : 해외배송 포함  
F : 해외배송 미포함

 |
| issue\_order\_amount\_type | 

발급가능 구매금액 유형

O : 구매금액 기준  
S : 실결제 금액기준

 |
| issue\_order\_start\_date | 

쿠폰발급 가능한 주문시작일시

 |
| issue\_order\_end\_date | 

쿠폰발급 가능한 주문종료일시

 |
| issue\_order\_amount\_limit | 

발급 가능 구매 금액 제한 유형

U : 제한 없음  
L : 최소 금액  
S : 금액 범위

 |
| issue\_order\_amount\_min | 

발급 가능 최소 구매 금액

 |
| issue\_order\_amount\_max | 

발급 가능 최대 구매 금액

 |
| issue\_order\_path | 

주문경로

W : 웹 쇼핑몰 전용  
M : 모바일 쇼핑몰 전용  
P : 플러스앱 전용

 |
| issue\_order\_type | 

발급단위

O : 주문서단위 발급쿠폰  
P : 상품단위 발급쿠폰

 |
| issue\_order\_available\_product | 

발급 대상 상품

U : 제한 없음  
I : 선택 상품 적용  
E : 선택 상품 제외

 |
| issue\_order\_available\_category | 

발급 대상 카테고리

U : 제한 없음  
I : 선택 상품 적용  
E : 선택 상품 제외

 |
| issue\_max\_count | 

최대 발급수

 |
| issue\_max\_count\_by\_user | 

동일인 재발급 가능 여부

 |
| issue\_count\_per\_once | 

쿠폰발급 회당 발급수량 (1회 발급수량)

 |
| issued\_count | 

발급된 수량

 |
| available\_date | 

쿠폰 사용기간

 |
| available\_period\_type | 

사용기간 유형

F : 일반 기간  
R : 쿠폰 발급일 기준  
M : 당월 말까지 사용

 |
| available\_begin\_datetime | 

사용 기간 시작 일시

 |
| available\_end\_datetime | 

사용 기간 종료 일시

 |
| available\_site | 

사용 범위 유형

W : 웹 쇼핑몰 전용  
M : 모바일 쇼핑몰 전용

 |
| available\_scope | 

적용 범위

P : 상품 쿠폰  
O : 주문서 쿠폰

 |
| available\_day\_from\_issued | 

사용 가능 일수

 |
| available\_price\_type | 

사용가능 구매 금액 유형

U : 제한 없음  
O : 주문 금액 기준  
P : 상품 금액 기준

 |
| available\_order\_price\_type | 

사용가능 구매 금액 상세 유형

U : 모든 상품의 주문 금액  
I : 쿠폰 적용 상품의 주문 금액

 |
| available\_min\_price  

_최소: \[0.01\]~최대: \[999999999\]_

 | 

사용가능 구매 금액

 |
| available\_amount\_type | 

적용 계산 기준

E : 할인(쿠폰 제외) 적용 전 결제 금액  
I : 할인(쿠폰 제외) 적용 후 결제 금액

 |
| available\_payment\_method | 

사용가능 결제수단

all : 제한없음  
R : 무통장입금  
E : 가상계좌  
C : 신용카드  
A : 계좌이체  
H : 휴대폰  
M : 적립금  
K : 케이페이  
P : 페이나우  
N : 페이코  
O : 카카오페이  
S : 스마일페이  
V : 네이버페이  
B : 편의점  
D : 토스

 |
| available\_product | 

쿠폰적용 상품 선택

U : 제한 없음  
I : 선택 상품 적용  
E : 선택 상품 제외

 |
| available\_product\_list | 

쿠폰적용 상품 리스트

 |
| available\_category | 

쿠폰적용 분류 선택

U : 제한 없음  
I : 선택 카테고리 적용  
E : 선택 카테고리 제외

 |
| available\_category\_list | 

쿠폰적용 분류 리스트

 |
| available\_coupon\_count\_by\_order | 

주문서 당 동일쿠폰 최대 사용 수

 |
| serial\_generate\_method | 

시리얼 쿠폰 생성방법

A:자동생성  
M:수동생성

 |
| show\_product\_detail | 

상품상세페이지 노출여부

T : 상품상세페이지 노출  
F : 상품상세페이지 미노출

 |
| discount\_amount | 

할인금액

 |
| discount\_rate | 

할인율

 |
| serial\_code\_type | 

시리얼코드 생성 방식

R: 다른 시리얼 코드로 생성  
S: 동일 시리얼 코드로 생성

 |
| serial\_generate\_auto | 

시리얼 쿠폰 자동생성 추가 정보

 |

### Retrieve coupon codes [](#retrieve-coupon-codes)cafe24

GET /api/v2/admin/serialcoupons

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| coupon\_no | 

쿠폰번호

 |
| coupon\_name | 

쿠폰명

 |
| benefit\_type | 

혜택 구분

,(콤마)로 여러 건을 검색할 수 있다.

A : 할인금액  
B : 할인율  
C : 적립금액  
D : 적립율  
E : 기본배송비 할인(전액할인)  
I : 기본배송비 할인(할인율)  
H : 기본배송비 할인(할인금액)  
J : 전체배송비 할인(전액할인)  
F : 즉시적립  
G : 예치금

 |
| issued\_flag | 

발급된 쿠폰 여부

T : 발급이력이 있는 쿠폰  
F : 발급이력이 없는 쿠폰

 |
| created\_start\_date  

_날짜_

 | 

검색 시작일

 |
| created\_end\_date  

_날짜_

 | 

검색 종료일

 |
| deleted | 

쿠폰삭제 여부

,(콤마)로 여러 건을 검색할 수 있다.

T : 삭제된 쿠폰  
F : 삭제되지 않은 쿠폰

DEFAULT F

 |
| issue\_order\_path | 

주문경로

W : PC  
M : 모바일  
P : 플러스앱

 |
| issue\_order\_type | 

발급단위

P : 상품 쿠폰  
O : 주문서 쿠폰

 |
| issue\_reserved | 

자동 발행 예약 사용 여부

T : 사용  
F : 사용하지 않음

 |
| available\_period\_type | 

사용기간 유형

,(콤마)로 여러 건을 검색할 수 있다.

F : 일반 기간  
R : 쿠폰 발급일 기준  
M : 당월 말까지 사용

 |
| available\_datetime  

_날짜_

 | 

해당 날짜에 발급 가능한 쿠폰 검색

available\_period\_type이 F일 때만 유효

 |
| available\_site | 

사용 범위 유형

W : 웹 쇼핑몰 전용  
M : 모바일 쇼핑몰 전용  
P : 플러스앱 전용

 |
| available\_scope | 

적용 범위

P : 상품 쿠폰  
O : 주문서 쿠폰

 |
| available\_price\_type | 

사용가능 구매 금액 유형

U : 제한 없음  
O : 주문 금액 기준  
P : 상품 금액 기준

 |
| available\_order\_price\_type | 

사용가능 구매 금액 상세 유형

U : 모든 상품의 주문 금액  
I : 쿠폰 적용 상품의 주문 금액

 |
| limit  

_최소: \[1\]~최대: \[500\]_

 | 

조회결과 최대건수

DEFAULT 100

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve coupon codes

*   [Retrieve coupon codes](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Generate coupon code [](#generate-coupon-code)cafe24

POST /api/v2/admin/serialcoupons

###### POST

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **coupon\_name**  
**Required**  

_글자수 최소: \[1자\]~최대: \[50자\]_

 | 

쿠폰명

 |
| **benefit\_type**  
**Required** | 

혜택 구분

A : 할인금액  
B : 할인율

 |
| **available\_period\_type**  
**Required** | 

사용기간 유형

F : 일반 기간  
R : 쿠폰 발급일 기준  
M : 당월 말까지 사용

 |
| available\_begin\_datetime  

_날짜_

 | 

사용 기간 시작 일시

 |
| available\_end\_datetime  

_날짜_

 | 

사용 기간 종료 일시

 |
| available\_day\_from\_issued  

_최소값: \[1\]_  
_최대값: \[999\]_

 | 

사용 가능 일수

 |
| **available\_site**  
**Required** | 

사용 범위 유형

W : 웹 쇼핑몰 전용  
M : 모바일 쇼핑몰 전용

 |
| **available\_scope**  
**Required** | 

적용 범위

P : 상품 쿠폰  
O : 주문서 쿠폰

 |
| **available\_product**  
**Required** | 

쿠폰적용 상품 선택

U : 제한 없음  
I : 선택 상품 적용  
E : 선택 상품 제외

 |
| available\_product\_list | 

쿠폰적용 상품 리스트

 |
| **available\_category**  
**Required** | 

쿠폰적용 분류 선택

U : 제한 없음  
I : 선택 카테고리 적용  
E : 선택 카테고리 제외

 |
| available\_category\_list | 

쿠폰적용 분류 리스트

 |
| **available\_amount\_type**  
**Required** | 

적용 계산 기준

E : 할인(쿠폰 제외) 적용 전 결제 금액  
I : 할인(쿠폰 제외) 적용 후 결제 금액

 |
| **available\_coupon\_count\_by\_order**  
**Required**  

_최소값: \[1\]_  
_최대값: \[999\]_

 | 

주문서 당 동일쿠폰 최대 사용 수

 |
| available\_price\_type | 

사용가능 구매 금액 유형

U : 제한 없음  
O : 주문 금액 기준  
P : 상품 금액 기준

DEFAULT U

 |
| available\_order\_price\_type | 

사용가능 구매 금액 상세 유형

U : 모든 상품의 주문 금액  
I : 쿠폰 적용 상품의 주문 금액

 |
| available\_min\_price  

_최소: \[0.01\]~최대: \[999999999\]_

 | 

사용가능 구매 금액

 |
| discount\_amount | 

할인금액

 |
| 

discount\_amount 하위 요소 보기

**benefit\_price**  
**Required**  
혜택 금액







 |
| discount\_rate | 

할인율

 |
| 

discount\_rate 하위 요소 보기

**benefit\_percentage**  
**Required**  
혜택 비율

**benefit\_percentage\_round\_unit**  
**Required**  
혜택 비율 절사 단위

**benefit\_percentage\_max\_price**  
**Required**  
혜택 비율 최대 금액







 |
| **serial\_generate\_method**  
**Required** | 

시리얼 쿠폰 생성방법

A:자동생성  
M:수동생성

 |
| **serial\_code\_type**  
**Required** | 

시리얼코드 생성 방식

R: 다른 시리얼 코드로 생성  
S: 동일 시리얼 코드로 생성

 |
| serial\_generate\_auto | 

시리얼 쿠폰 자동생성 추가 정보

 |
| 

serial\_generate\_auto 하위 요소 보기

**issue\_max\_count**  
**Required**  
자동생성 개수

**serial\_code\_length**  
**Required**  
자동생성 시리얼코드 자리수







 |

Generate coupon code

*   [Generate coupon code](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete coupon code [](#delete-coupon-code)cafe24

DELETE /api/v2/admin/serialcoupons/{coupon\_no}

###### DELETE

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| coupon\_no | 
쿠폰번호

 |

Delete coupon code

*   [Delete coupon code](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Serialcoupons issues

시리얼코드로 발급한 쿠폰을 관리하는 기능을 제공합니다.

> Endpoints

```
GET /api/v2/admin/serialcoupons/{coupon_no}/issues
POST /api/v2/admin/serialcoupons/{coupon_no}/issues
```

#### \[더보기 상세 내용\]

### Serialcoupons issues property list[](#serialcoupons__issues-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| coupon\_no | 

쿠폰번호

 |
| serial\_code | 

시리얼코드

 |
| member\_id | 

회원아이디

 |
| verify | 

인증여부

Y:인증  
N:미인증

 |
| verify\_datetime | 

인증일시

 |
| used\_datetime | 

사용일시

 |
| deleted | 

쿠폰삭제 여부

T : 삭제  
F : 삭제되지 않음

 |

### Retrieve a code of coupon codes [](#retrieve-a-code-of-coupon-codes)cafe24

GET /api/v2/admin/serialcoupons/{coupon\_no}/issues

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 읽기권한 (mall.read\_promotion)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| coupon\_no | 

쿠폰번호

 |
| offset  

_최대값: \[10000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[500\]_

 | 

조회결과 최대건수

DEFAULT 100

 |

Retrieve a code of coupon codes

*   [Retrieve a code of coupon codes](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Register a code of coupon codes [](#register-a-code-of-coupon-codes)cafe24

POST /api/v2/admin/serialcoupons/{coupon\_no}/issues

###### POST

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **프로모션 쓰기권한 (mall.write\_promotion)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| coupon\_no | 

쿠폰번호

 |
| **serial\_code\_list**  
**Required**  

_배열 최대사이즈: \[10000\]_

 | 

시리얼넘버 목록

 |

Register a code of coupon codes

*   [Register a code of coupon codes](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Application

## Apps

앱(Apps)는 앱의 정보를 조회하고 수정할 수 있는 리소스입니다.  
해당 정보는 앱의 정보이므로, 서로 다른 쇼핑몰에서 호출해도 동일한 정보가 조회되는게 특징입니다.  
앱의 버전 정보를 조회하거나 앱의 버전을 API를 통해 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/apps
PUT /api/v2/admin/apps
```

#### \[더보기 상세 내용\]

### Apps property list[](#apps-property-list)

| **Attribute** | **Description** |
| --- | --- |
| version | 
버전

 |
| version\_expiration\_date | 

버전 만료일

 |
| initial\_version | 

최초 버전

 |
| previous\_version | 

이전 버전

 |
| extension\_type | 

확장 타입

section : 섹션(쇼핑몰 프론트에 html 삽입이 필요한 앱 타입)  
embedded : 임베디드(쇼핑몰 프론트에 임베디드되어 자동으로 구동되는 앱 타입)

 |

### Retrieve an app information [](#retrieve-an-app-information)cafe24

GET /api/v2/admin/apps

###### GET

해당 앱의 버전을 조회할 수 있습니다.  
현재 사용 중인 버전의 정보와 버전 만료일, 이전에 사용하던 버전 정보를 확인할 수 있습니다.  
해당 정보는 앱의 정보이기 때문에 어떤 쇼핑몰에서 조회해도 동일한 결과가 응답됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 읽기권한 (mall.read\_application)** |
| 호출건수 제한 | **40** |

Retrieve an app information

*   [Retrieve an app information](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update an app information [](#update-an-app-information)cafe24

PUT /api/v2/admin/apps

###### PUT

해당 앱의 버전을 변경할 수 있습니다.  
앱 버전 변경시 최초 버전(initial\_version)보다 이전 버전으로 변경은 불가능합니다.  
해당 정보는 앱의 정보이기 때문에 어떤 쇼핑몰에서 호출해도 모든 쇼핑몰의 API 버전 정보가 변경됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 쓰기권한 (mall.write\_application)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| version | 
버전

 |
| extension\_type | 

확장 타입

section : 섹션(쇼핑몰 프론트에 html 삽입이 필요한 앱 타입)  
embedded : 임베디드(쇼핑몰 프론트에 임베디드되어 자동으로 구동되는 앱 타입)

 |

Update an app information

*   [Update an app information](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Appstore orders

앱스토어 주문(Appstore orders)은 앱에서 사용 금액이나 기타 금액을 쇼핑몰 운영자에게 부과하기 위한 주문입니다.  
앱스토어 주문 생성을 통해 쇼핑몰 운영자에게 결제 필요한 금액을 부과할 수 있으며, 생성된 주문을 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/appstore/orders/{order_id}
POST /api/v2/admin/appstore/orders
```

#### \[더보기 상세 내용\]

### Appstore orders property list[](#appstore-orders-property-list)

| **Attribute** | **Description** |
| --- | --- |
| order\_id | 
주문아이디

앱스토어 주문의 주문 ID

 |
| order\_name | 

주문명

앱스토어 주문의 주문 이름. 주문 생성시 지정이 가능하며, 사용자가 결제시 해당 결제의 내용이 무엇인지 알 수 있는 내용이어야 함.

 |
| order\_amount | 

주문금액

앱스토어 주문 생성시 결제 요청한 주문 금액

 |
| currency | 

화폐단위

KRW : ￦ 원  
USD : $ 달러  
JPY : ¥ 엔  
PHP : ₱ 페소

 |
| return\_url | 

Return Url

사용자가 결제 후 이동해야하는 페이지.

 |
| automatic\_payment  

_최대글자수 : \[1자\]_

 | 

정기과금 여부

T : 사용함  
F : 사용안함

 |
| created\_date | 

주문 생성일

 |
| confirmation\_url | 

결제 Url

사용자가 결제하기 위해 자동으로 이동하는 페이지 주소

 |

### Retreive a Cafe24 Store order [](#retreive-a-cafe24-store-order)cafe24

GET /api/v2/admin/appstore/orders/{order\_id}

###### GET

생성된 앱스토어 주문을 조회할 수 있습니다.  
주문명, 주문금액, 정기과금 여부 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 읽기권한 (mall.read\_application)** |
| 호출건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| order\_id | 
주문번호

조회하고자하는 앱스토어 주문 번호

 |

Retreive a Cafe24 Store order

*   [Retreive a Cafe24 Store order](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a Cafe24 Store order [](#create-a-cafe24-store-order)cafe24

POST /api/v2/admin/appstore/orders

###### POST

앱스토어 주문을 생성할 수 있습니다.  
앱스토어 주문을 생성하면 앱 사용자(쇼핑몰 운영자)에게 사용 요금을 부과할 수 있습니다.  
또한 정기과금으로 부과할지 선택도 가능합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 쓰기권한 (mall.write\_application)** |
| 호출건수 제한 | **10** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **order\_name**  
**Required**  
_최대글자수 : \[100자\]_

 | 

주문명

앱스토어 주문의 주문 이름. 주문 생성시 지정이 가능하며, 사용자가 결제시 해당 결제의 내용이 무엇인지 알 수 있는 내용이어야 함.

 |
| **order\_amount**  
**Required** | 

주문금액

사용자에게 결제 받고자 하는 주문 금액 입력

 |
| **return\_url**  
**Required**  

_최대글자수 : \[250자\]_

 | 

Return Url

사용자가 결제 후 이동해야하는 페이지. 결제 완료 페이지 주소를 입력한다.

 |
| automatic\_payment  

_최대글자수 : \[1자\]_

 | 

정기과금 여부

T : 사용함  
F : 사용안함

DEFAULT F

 |

Create a Cafe24 Store order

*   [Create a Cafe24 Store order](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Appstore payments

앱스토어 주문을 결제 완료한 경우 앱스토어 결제 조회를 통해 결제 내역을 확인할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/appstore/payments
GET /api/v2/admin/appstore/payments/count
```

#### \[더보기 상세 내용\]

### Appstore payments property list[](#appstore-payments-property-list)

| **Attribute** | **Description** |
| --- | --- |
| order\_id | 
결제번호

앱스토어 주문의 주문 ID

 |
| payment\_status | 

결제상태

paid : 결제완료  
refund : 환불

 |
| title | 

결제 명

앱스토어 주문의 주문 이름. 주문 생성시 지정이 가능하며, 사용자가 결제시 해당 결제의 내용이 무엇인지 알 수 있는 내용이어야 함.

 |
| approval\_no | 

승인번호

결제 승인 번호

 |
| payment\_gateway\_name | 

결제 PG사 이름

 |
| payment\_method | 

결제수단

 |
| payment\_amount | 

결제금액

 |
| refund\_amount | 

환불금액

 |
| currency | 

화폐단위

KRW : ￦ 원  
USD : $ 달러  
JPY : ¥ 엔  
PHP : ₱ 페소

 |
| locale\_code | 

결제국가

 |
| automatic\_payment | 

정기과금 여부

T : 사용함  
F : 사용안함

 |
| pay\_date | 

결제승인일

 |
| refund\_date | 

환불승인일

 |
| expiration\_date | 

만료일

 |

### Retrieve a list of Cafe24 Store payments [](#retrieve-a-list-of-cafe24-store-payments)cafe24

GET /api/v2/admin/appstore/payments

###### GET

쇼핑몰 운영자가 결제한 앱스토어 이용 결제 내역의 카운트를 확인할 수 있습니다.  
결제상태, 결제명, 승인번호 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 읽기권한 (mall.read\_application)** |
| 호출건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| order\_id | 
주문번호

조회하고자하는 앱스토어 주문 번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| **start\_date**  
**Required**  

_날짜_

 | 

검색 시작일

해당일 이후에 결제완료된 주문 검색

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

해당일 이전에 결제완료된 주문 검색

 |
| currency | 

화폐단위

KRW : ￦ 원  
USD : $ 달러  
JPY : ¥ 엔  
PHP : ₱ 페소

 |
| limit  

_최소: \[1\]~최대: \[50\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 20

 |
| offset  

_최대값: \[10000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a list of Cafe24 Store payments

*   [Retrieve a list of Cafe24 Store payments](#none)
*   [Retrieve payments with fields parameter](#none)
*   [Retrieve a specific payments with order\_id parameter](#none)
*   [Retrieve payments using paging](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of Cafe24 Store payments [](#retrieve-a-count-of-cafe24-store-payments)cafe24

GET /api/v2/admin/appstore/payments/count

###### GET

쇼핑몰 운영자가 결제한 앱스토어 이용 결제 내역을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 읽기권한 (mall.read\_application)** |
| 호출건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| order\_id | 
주문번호

조회하고자하는 앱스토어 주문 번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| **start\_date**  
**Required**  

_날짜_

 | 

검색 시작일

해당일 이후에 결제완료된 주문 검색

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

해당일 이전에 결제완료된 주문 검색

 |
| currency | 

화폐단위

KRW : ￦ 원  
USD : $ 달러  
JPY : ¥ 엔  
PHP : ₱ 페소

 |

Retrieve a count of Cafe24 Store payments

*   [Retrieve a count of Cafe24 Store payments](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Databridge logs

쇼핑몰의 전환추적 이벤트 웹훅 정보를 제공합니다.

> Endpoints

```
GET /api/v2/admin/databridge/logs
```

#### \[더보기 상세 내용\]

### Databridge logs property list[](#databridge-logs-property-list)

| **Attribute** | **Description** |
| --- | --- |
| log\_id | 
로그 ID

 |
| mall\_id | 

쇼핑몰 ID

 |
| trace\_id | 

Trace ID

 |
| requested\_time | 

전송일시

 |
| request\_endpoint | 

요청 URL

 |
| request\_body | 

요청 내용

 |
| success | 

웹훅 발송 성공 여부

T : 성공  
F : 실패

 |
| response\_http\_code | 

응답 http code

 |
| response\_body | 

응답 내용

 |

### Retrieve a list of Databridge webhook logs [](#retrieve-a-list-of-databridge-webhook-logs)cafe24

GET /api/v2/admin/databridge/logs

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 읽기권한 (mall.read\_application)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| requested\_start\_date  
_날짜_

 | 

발송 시작일시

 |
| requested\_end\_date  

_날짜_

 | 

발송 종료일시

 |
| success | 

웹훅 발송 성공 여부

T : 성공  
F : 실패

 |
| since\_log\_id | 

해당 로그 ID 이후 검색

 |
| limit  

_최소: \[1\]~최대: \[10000\]_

 | 

조회결과 최대건수

 |

Retrieve a list of Databridge webhook logs

*   [Retrieve a list of Databridge webhook logs](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Recipes

레시피(Recipes)와 관련된 기능으로,  
쇼핑몰에 레시피를 등록하거나, 등록된 레시피를 목록으로 조회하거나, 등록된 레시피를 삭제할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/recipes
POST /api/v2/admin/recipes
DELETE /api/v2/admin/recipes/{recipe_code}
```

#### \[더보기 상세 내용\]

### Recipes property list[](#recipes-property-list)

| **Attribute** | **Description** |
| --- | --- |
| recipe\_code | 
레시피 코드

 |
| recipe\_name  

_최대글자수 : \[200자\]_

 | 

레시피 이름

 |
| active | 

활성화 여부

T : 활성화  
F : 비활성화

 |

### Retrieve a list of recipes [](#retrieve-a-list-of-recipes)cafe24

GET /api/v2/admin/recipes

###### GET

쇼핑몰에 등록된 레시피를 목록으로 조회할 수 있습니다.  
레시피 코드, 이름, 활성화 여부를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 읽기권한 (mall.read\_application)** |
| 호출건수 제한 | **40** |

Retrieve a list of recipes

*   [Retrieve a list of recipes](#none)
*   [Retrieve recipes with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a recipe [](#create-a-recipe)cafe24

POST /api/v2/admin/recipes

###### POST

쇼핑몰에 레시피를 등록할 수 있습니다.  
레시피 등록을 위해서는 레시피가 이미 생성되어있어야 하며 해당 생성된 레시피 코드가 필요합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 쓰기권한 (mall.write\_application)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **recipe\_code**  
**Required** | 
레시피 코드

 |
| trigger\_settings | 

트리거 설정

 |
| 

trigger\_settings 하위 요소 보기

**required\_filters** _Array_

required\_filters 하위 요소 보기

**name**  
조건 이름

**value**  
조건 값

**operator**  
조건 연산자

**optional\_filters** _Array_

optional\_filters 하위 요소 보기

**condition** _Array_  

condition 하위 요소 보기

**name**  
조건 이름

**value**  
조건 값

**operator**  
조건 연산자



















 |

Create a recipe

*   [Create a recipe](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a recipe [](#delete-a-recipe)cafe24

DELETE /api/v2/admin/recipes/{recipe\_code}

###### DELETE

쇼핑몰에 등록된 레시피를 등록해제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 쓰기권한 (mall.write\_application)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **recipe\_code**  
**Required** | 
레시피 코드

 |

Delete a recipe

*   [Delete a recipe](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Scripttags

스크립트태그(Scripttags)는 앱에서 쇼핑몰의 특정 화면(Page)에 스크립트를 설치하기 위해 사용할 수 있는 기능입니다.  
스크립트 API를 사용해 쇼핑몰의 디자인을 변경하지 않고 쇼핑몰 화면에 스크립트를 쉽게 추가할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/scripttags
GET /api/v2/admin/scripttags/count
GET /api/v2/admin/scripttags/{script_no}
POST /api/v2/admin/scripttags
PUT /api/v2/admin/scripttags/{script_no}
DELETE /api/v2/admin/scripttags/{script_no}
```

#### \[더보기 상세 내용\]

### Scripttags property list[](#scripttags-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| script\_no | 

script의 고유번호

스크립트의 고유 번호

 |
| client\_id | 

Client ID

스크립트를 설치한 Client의 ID

 |
| src  

_URL_

 | 

원본 script 경로

설치할 스크립트의 원본 경로(절대 경로)

 |
| display\_location | 

화면 경로

스크립트를 표시할 "화면 경로". 화면 경로는 화면의 페이지 경로가 아니라 쇼핑몰의 각 페이지에 부여된 특정한 역할을 의미함.  
(예 : 상품분류(product\_list)에 스크립트를 삽입할 경우 쇼핑몰에서 상품분류로 사용되는 모든 페이지에 스크립트가 노출됨)  
  
화면의 역할은 해당 페이지에 사용된 모듈에 따라 자동으로 부여됨. 임의의 페이지에 상품분류 모듈을 추가하면 해당 페이지는 "상품분류" 역할로 인식된다. 쇼핑몰 관리자 화면의 \[쇼핑몰 설정 > 사이트 설정 > '사이트 환경 설정 > 쇼핑몰 환경 설정 > 화면경로 > 화면경로 설정'\]에서 각 페이지에 부여된 화면 역할을 조회하고 설정할 수 있음.  
  
"all" 일 경우 전체 페이지에 스크립트가 적용됨.  
  
[display\_location\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/display_location_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| exclude\_path | 

제외 경로

 |
| skin\_no | 

스킨 번호

스크립트를 적용할 스킨 번호

 |
| integrity | 

하위 리소스 무결성

스크립트 위변조를 방지하기위한 무결성 검증용 해시. (sha384, sha512 해시 알고리즘 지원)  
  
[Integrity 해시 생성방법 참고](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/shortcut_icon.png)

 |
| created\_date | 

생성일

스크립트 설치 날짜

 |
| updated\_date | 

수정일

스크립트 수정 날짜

 |

### Retrieve a list of script tags [](#retrieve-a-list-of-script-tags)cafe24

GET /api/v2/admin/scripttags

###### GET

쇼핑몰에 설치된 스크립트를 목록으로 조회할 수 있습니다.  
스크립트 고유번호, 화면경로, 생성일 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 읽기권한 (mall.read\_application)** |
| 호출건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| script\_no | 

script의 고유번호

스크립트의 고유 번호 검색

 |
| src  

_URL_

 | 

원본 script 경로

원본 스크립트 경로 검색

 |
| display\_location | 

화면 경로

스크립트를 표시할 "화면 경로". 화면 경로는 화면의 페이지 경로가 아니라 쇼핑몰의 각 페이지에 부여된 특정한 역할을 의미함.  
(예 : 상품분류(product\_list)에 스크립트를 삽입할 경우 쇼핑몰에서 상품분류로 사용되는 모든 페이지에 스크립트가 노출됨)  
  
화면의 역할은 해당 페이지에 사용된 모듈에 따라 자동으로 부여됨. 임의의 페이지에 상품분류 모듈을 추가하면 해당 페이지는 "상품분류" 역할로 인식된다. 쇼핑몰 관리자 화면의 \[쇼핑몰 설정 > 사이트 설정 > '사이트 환경 설정 > 쇼핑몰 환경 설정 > 화면경로 > 화면경로 설정'\]에서 각 페이지에 부여된 화면 역할을 조회하고 설정할 수 있음.  
  
"all" 일 경우 전체 페이지에 스크립트가 적용됨.  
  
[display\_location\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/display_location_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| exclude\_path | 

제외 경로

,(콤마)로 여러 건을 검색할 수 있다.

 |
| skin\_no | 

스킨 번호

스크립트를 적용할 스킨 번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| integrity | 

하위 리소스 무결성

 |
| created\_start\_date  

_날짜_

 | 

스크립트 설치일 검색 시작일

스크립트 설치 날짜가 해당 날짜 이후인 스크립트 검색  
검색 종료일과 같이 사용해야함.

 |
| created\_end\_date  

_날짜_

 | 

스크립트 설치일 검색 종료일

스크립트 설치 날짜가 해당 날짜 이전인 스크립트 검색  
검색 시작일과 같이 사용해야함.

 |
| updated\_start\_date  

_날짜_

 | 

스크립트 수정일 검색 시작일

스크립트 수정 날짜가 해당 날짜 이후인 스크립트 검색  
검색 종료일과 같이 사용해야함.

 |
| updated\_end\_date  

_날짜_

 | 

스크립트 수정일 검색 종료일

스크립트 수정 날짜가 해당 날짜 이전인 스크립트 검색  
검색 시작일과 같이 사용해야함.

 |

Retrieve a list of script tags

*   [Retrieve a list of script tags](#none)
*   [Retrieve scripttags with fields parameter](#none)
*   [Retrieve a specific scripttags with script\_no parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of script tags [](#retrieve-a-count-of-script-tags)cafe24

GET /api/v2/admin/scripttags/count

###### GET

쇼핑몰에 설치된 스크립트의 수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 읽기권한 (mall.read\_application)** |
| 호출건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| script\_no | 

script의 고유번호

스크립트의 고유 번호 검색

 |
| src  

_URL_

 | 

원본 script 경로

원본 스크립트 경로 검색

 |
| display\_location | 

화면 경로

스크립트를 표시할 "화면 경로". 화면 경로는 화면의 페이지 경로가 아니라 쇼핑몰의 각 페이지에 부여된 특정한 역할을 의미함.  
(예 : 상품분류(product\_list)에 스크립트를 삽입할 경우 쇼핑몰에서 상품분류로 사용되는 모든 페이지에 스크립트가 노출됨)  
  
화면의 역할은 해당 페이지에 사용된 모듈에 따라 자동으로 부여됨. 임의의 페이지에 상품분류 모듈을 추가하면 해당 페이지는 "상품분류" 역할로 인식된다. 쇼핑몰 관리자 화면의 \[쇼핑몰 설정 > 사이트 설정 > '사이트 환경 설정 > 쇼핑몰 환경 설정 > 화면경로 > 화면경로 설정'\]에서 각 페이지에 부여된 화면 역할을 조회하고 설정할 수 있음.  
  
"all" 일 경우 전체 페이지에 스크립트가 적용됨.  
  
[display\_location\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/display_location_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| skin\_no | 

스킨 번호

스크립트를 적용할 스킨 번호.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| created\_start\_date  

_날짜_

 | 

스크립트 설치일 검색 시작일

스크립트 설치 날짜가 해당 날짜 이후인 스크립트 검색  
검색 종료일과 같이 사용해야함.

 |
| created\_end\_date  

_날짜_

 | 

스크립트 설치일 검색 종료일

스크립트 설치 날짜가 해당 날짜 이전인 스크립트 검색  
검색 종료일과 같이 사용해야함.

 |
| updated\_start\_date  

_날짜_

 | 

스크립트 수정일 검색 시작일

스크립트 수정 날짜가 해당 날짜 이후인 스크립트 검색  
검색 종료일과 같이 사용해야함.

 |
| updated\_end\_date  

_날짜_

 | 

스크립트 수정일 검색 종료일

스크립트 수정 날짜가 해당 날짜 이전인 스크립트 검색  
검색 시작일과 같이 사용해야함.

 |

Retrieve a count of script tags

*   [Retrieve a count of script tags](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a script tag [](#retrieve-a-script-tag)cafe24

GET /api/v2/admin/scripttags/{script\_no}

###### GET

쇼핑몰에 설치된 특정 스크립트를 조회할 수 있습니다.  
화면경로, 스킨번호, 생성일, 수정일 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 읽기권한 (mall.read\_application)** |
| 호출건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| script\_no | 

script의 고유번호

스크립트의 고유 번호 검색

 |

Retrieve a script tag

*   [Retrieve a script tag](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a script tag [](#create-a-script-tag)cafe24

POST /api/v2/admin/scripttags

###### POST

스크립트태그를 쇼핑몰의 특정 화면에 설치할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 쓰기권한 (mall.write\_application)** |
| 호출건수 제한 | **10** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| src  

_URL_

 | 

원본 script 경로

설치할 스크립트의 원본 경로(절대 경로)

 |
| **display\_location**  
**Required** | 

화면 경로

스크립트를 표시할 "화면 경로". 화면 경로는 화면의 페이지 경로가 아니라 쇼핑몰의 각 페이지에 부여된 특정한 역할을 의미함.  
(예 : 상품분류(product\_list)에 스크립트를 삽입할 경우 쇼핑몰에서 상품분류로 사용되는 모든 페이지에 스크립트가 노출됨)  
  
화면의 역할은 해당 페이지에 사용된 모듈에 따라 자동으로 부여됨. 임의의 페이지에 상품분류 모듈을 추가하면 해당 페이지는 "상품분류" 역할로 인식된다. 쇼핑몰 관리자 화면의 \[쇼핑몰 설정 > 사이트 설정 > '사이트 환경 설정 > 쇼핑몰 환경 설정 > 화면경로 > 화면경로 설정'\]에서 각 페이지에 부여된 화면 역할을 조회하고 설정할 수 있음.  
  
"all" 일 경우 전체 페이지에 스크립트가 적용됨.  
  
[display\_location\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/display_location_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| exclude\_path | 

제외 경로

 |
| skin\_no | 

스킨 번호

스크립트를 적용할 스킨 번호.

 |
| integrity | 

하위 리소스 무결성

스크립트 위변조를 방지하기위한 무결성 검증용 해시. (sha384, sha512 해시 알고리즘 지원)  
  
[Integrity 해시 생성방법 참고](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/shortcut_icon.png)

 |

Create a script tag

*   [Create a script tag](#none)
*   [Insert scripttag to specific location](#none)
*   [Try to insert scripttag without location](#none)
*   [Insert scripttag to specific skin](#none)
*   [Insert scripttag to all location but specific path](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a script tag [](#update-a-script-tag)cafe24

PUT /api/v2/admin/scripttags/{script\_no}

###### PUT

쇼핑몰에 설치된 스크립트를 업데이트할 수 있습니다.  
앱을 재설치할 필요 없이 스크립트만 업데이트 할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 쓰기권한 (mall.write\_application)** |
| 호출건수 제한 | **10** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **script\_no**  
**Required** | 

script의 고유번호

스크립트의 고유 번호

 |
| src  

_URL_

 | 

원본 script 경로

설치할 스크립트의 원본 경로(절대 경로)

 |
| display\_location | 

화면 경로

스크립트를 표시할 "화면 경로". 화면 경로는 화면의 페이지 경로가 아니라 쇼핑몰의 각 페이지에 부여된 특정한 역할을 의미함.  
(예 : 상품분류(product\_list)에 스크립트를 삽입할 경우 쇼핑몰에서 상품분류로 사용되는 모든 페이지에 스크립트가 노출됨)  
  
화면의 역할은 해당 페이지에 사용된 모듈에 따라 자동으로 부여됨. 임의의 페이지에 상품분류 모듈을 추가하면 해당 페이지는 "상품분류" 역할로 인식된다. 쇼핑몰 관리자 화면의 \[쇼핑몰 설정 > 사이트 설정 > '사이트 환경 설정 > 쇼핑몰 환경 설정 > 화면경로 > 화면경로 설정'\]에서 각 페이지에 부여된 화면 역할을 조회하고 설정할 수 있음.  
  
"all" 일 경우 전체 페이지에 스크립트가 적용됨.  
  
[display\_location\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/display_location_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| exclude\_path | 

제외 경로

 |
| skin\_no | 

스킨 번호

스크립트를 적용할 스킨 번호.

 |
| integrity | 

하위 리소스 무결성

스크립트 위변조를 방지하기위한 무결성 검증용 해시. (sha384, sha512 해시 알고리즘 지원)  
  
[Integrity 해시 생성방법 참고](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/shortcut_icon.png)

 |

Update a script tag

*   [Update a script tag](#none)
*   [Update path of the script](#none)
*   [Update skin\_no in which the script is displayed](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a script tag [](#delete-a-script-tag)cafe24

DELETE /api/v2/admin/scripttags/{script\_no}

###### DELETE

쇼핑몰에 설치되어 있는 스크립트를 삭제할 수 있습니다.  
멀티쇼핑몰별로 삭제하려면 엔드포인트 뒤에 "?shop\_no=N"을 추가하면 됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 쓰기권한 (mall.write\_application)** |
| 호출건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **script\_no**  
**Required** | 
script의 고유번호

스크립트의 고유 번호

 |

Delete a script tag

*   [Delete a script tag](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Webhooks logs

웹훅 로그(Webhooks logs)를 통해 앱에서 발생한 웹훅의 로그를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/webhooks/logs
```

#### \[더보기 상세 내용\]

### Webhooks logs property list[](#webhooks-logs-property-list)

| **Attribute** | **Description** |
| --- | --- |
| log\_id | 
로그 ID

 |
| log\_type | 

로그 종류

G : 일반 발송  
R : 재발송  
T : 테스트 발송

 |
| event\_no | 

이벤트 번호

 |
| mall\_id | 

쇼핑몰 ID

 |
| trace\_id | 

Trace ID

 |
| requested\_time | 

전송일시

 |
| request\_endpoint | 

요청 URL

 |
| request\_body | 

요청 내용

 |
| success | 

웹훅 발송 성공 여부

T : 성공  
F : 실패

 |
| response\_http\_code | 

응답 http code

 |
| response\_body | 

응답 내용

 |

### Retrieve a list of webhook logs [](#retrieve-a-list-of-webhook-logs)cafe24

GET /api/v2/admin/webhooks/logs

###### GET

앱에서 발생한 웹훅 로그의 목록을 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 읽기권한 (mall.read\_application)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| event\_no | 
이벤트 번호

 |
| requested\_start\_date  

_날짜_

 | 

발송 시작일시

 |
| requested\_end\_date  

_날짜_

 | 

발송 종료일시

 |
| success | 

웹훅 발송 성공 여부

T : 성공  
F : 실패

 |
| log\_type | 

로그 종류

G : 일반 발송  
R : 재발송  
T : 테스트 발송

 |
| since\_log\_id | 

해당 로그 ID 이후 검색

 |
| limit  

_최소: \[1\]~최대: \[10000\]_

 | 

조회결과 최대건수

 |

Retrieve a list of webhook logs

*   [Retrieve a list of webhook logs](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Webhooks setting

쇼핑몰이 웹훅 사용에 동의(실시간 정보 조회 권한 동의)에 대해 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/webhooks/setting
PUT /api/v2/admin/webhooks/setting
```

#### \[더보기 상세 내용\]

### Webhooks setting property list[](#webhooks-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| scopes | 
실시간 정보제공 권한

 |
| reception\_status | 

웹훅 수신 상태

T : 활성화  
F : 비활성화

 |

### Retrieve webhook settings [](#retrieve-webhook-settings)cafe24

GET /api/v2/admin/webhooks/setting

###### GET

쇼핑몰이 웹훅 사용에 동의(실시간 정보 조회 권한 동의)에 대해 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 읽기권한 (mall.read\_application)** |
| 호출건수 제한 | **40** |

Retrieve webhook settings

*   [Retrieve webhook settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Edit webhook settings [](#edit-webhook-settings)cafe24

PUT /api/v2/admin/webhooks/setting

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **앱 쓰기권한 (mall.write\_application)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| reception\_status | 
웹훅 수신 상태

T : 활성화  
F : 비활성화

 |

Edit webhook settings

*   [Edit webhook settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Category

## Autodisplay

자동 진열(Autodisplay)은 상품 분류에 특정 조건에 따라 상품을 자동으로 진열해주는 기능입니다.  
예를 들어 가장 판매량이 높은 순서대로 상품을 진열하거나 좋아요 수가 높은 수 등으로 진열되도록 설정할 수 있습니다.  
해당 리소스에서는 자동 진열 조건을 생성하거나, 수정, 삭제하고 자동 진열 조건을 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/autodisplay
POST /api/v2/admin/autodisplay
PUT /api/v2/admin/autodisplay/{display_no}
DELETE /api/v2/admin/autodisplay/{display_no}
```

#### \[더보기 상세 내용\]

### Autodisplay property list[](#autodisplay-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| display\_no | 

자동진열 번호

 |
| use\_main | 

메인분류 여부

T: 메인분류  
F: 상품분류

 |
| category\_no | 

분류 번호

 |
| display\_group | 

상세 상품분류

 |
| display\_count  

_최소: \[1\]~최대: \[200\]_

 | 

자동진열 최대 상품 수

 |
| use\_reservation | 

예약진열 사용여부

T: 사용함  
F: 사용안함

 |
| start\_date | 

예약 시작일

 |
| use\_hashtag | 

해시태그 사용여부

T: 사용함  
F: 사용안함

 |
| hash\_tags | 

해시태그

 |
| display\_sort | 

정렬순서

AOD: 주문 수 높은 순서대로  
AOA: 주문 수 낮은 순서대로  
AVD: 조회 수 높은 순서대로  
AVA: 조회 수 낮은 순서대로  
ARD: 주문율 높은 순서대로  
ARA: 주문율 낮은 순서대로  
ACD: 클릭 가치 높은 순서대로  
AND: 신규 등록된 순서대로  
APD: 판매가 높은 순서대로  
APA: 판매가 낮은 순서대로  
RD : 최근 등록상품이 위로  
RA : 최근 등록상품이 아래로  
UD : 최근 수정상품이 위로  
UA : 최근 수정상품이 아래로  
NA : 상품명 가나다순  
ND : 상품명 가나다역순  
PD : 판매가 높은 상품이 위로  
PA : 판매가 높은 상품이 아래로  
SD : 판매량 높은 상품이 위로  
SA : 판매량 높은 상품이 아래로  
CD : 조회수가 높은 상품이 위로  
CA : 조회수가 높은 상품이 아래로  
LD : 좋아요수가 높은 상품이 위로  
LA : 좋아요수가 높은 상품이 아래로

 |
| timetable  

_배열 최대사이즈: \[24\]_

 | 

업데이트 시간

 |
| period | 

데이터 집계 기간

1: 1일  
3: 3일  
7: 1주(7일)  
30: 30일

 |
| except\_categories\_scope | 

제외 분류 설정

A: 모든 분류에 적용  
C : 이 분류만 적용

 |
| except\_categories | 

제외 분류

 |

### Retrieve a list of auto layouts [](#retrieve-a-list-of-auto-layouts)cafe24

GET /api/v2/admin/autodisplay

###### GET

생성된 모든 자동 진열을 목록을 통해 조회할 수 있습니다.  
자동진열 번호, 예약진열 사용여부, 자동진열 최대 상품 수 등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 읽기권한 (mall.read\_category)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| display\_no | 

자동진열 번호

 |

Retrieve a list of auto layouts

*   [Retrieve a list of auto layouts](#none)
*   [Retrieve autodisplay with fields parameter](#none)
*   [Retrieve a specific autodisplay with display\_no parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create auto layout for selected product category [](#create-auto-layout-for-selected-product-category)cafe24

POST /api/v2/admin/autodisplay

###### POST

특정 조건에 따라 자동 진열을 생성합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 쓰기권한 (mall.write\_category)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **use\_main**  
**Required** | 

메인분류 여부

T: 메인분류  
F: 상품분류

 |
| **category\_no**  
**Required** | 

분류 번호

 |
| **display\_group**  
**Required** | 

상세 상품분류

 |
| **display\_count**  
**Required**  

_최소: \[1\]~최대: \[200\]_

 | 

자동진열 최대 상품 수

 |
| **use\_reservation**  
**Required** | 

예약진열 사용여부

T: 사용함  
F: 사용안함

 |
| start\_date | 

예약 시작일

 |
| **use\_hashtag**  
**Required** | 

해시태그 사용여부

T: 사용함  
F: 사용안함

 |
| hash\_tags | 

해시태그

 |
| display\_sort | 

정렬순서

정렬 조건(RD, RA, UD, UA, NA, ND, PD, PA, SD, SA, AD, AA, LD, LA)은 use\_hashtag가 "T"일 경우에만 사용 가능

AOD: 주문 수 높은 순서대로  
AOA: 주문 수 낮은 순서대로  
AVD: 조회 수 높은 순서대로  
AVA: 조회 수 낮은 순서대로  
ARD: 주문율 높은 순서대로  
ARA: 주문율 낮은 순서대로  
ACD: 클릭 가치 높은 순서대로  
AND: 신규 등록된 순서대로  
APD: 판매가 높은 순서대로  
APA: 판매가 낮은 순서대로  
RD : 최근 등록상품이 위로  
RA : 최근 등록상품이 아래로  
UD : 최근 수정상품이 위로  
UA : 최근 수정상품이 아래로  
NA : 상품명 가나다순  
ND : 상품명 가나다역순  
PD : 판매가 높은 상품이 위로  
PA : 판매가 높은 상품이 아래로  
SD : 판매량 높은 상품이 위로  
SA : 판매량 높은 상품이 아래로  
CD : 조회수가 높은 상품이 위로  
CA : 조회수가 높은 상품이 아래로  
LD : 좋아요수가 높은 상품이 위로  
LA : 좋아요수가 높은 상품이 아래로

 |
| timetable  

_배열 최대사이즈: \[24\]_

 | 

업데이트 시간

 |
| period | 

데이터 집계 기간

1: 1일  
3: 3일  
7: 1주(7일)  
30: 30일

 |
| except\_categories\_scope | 

제외 분류 설정

A: 모든 분류에 적용  
C : 이 분류만 적용

DEFAULT A

 |
| except\_categories | 

제외 분류

 |

Create auto layout for selected product category

*   [Create auto layout for selected product category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update auto layout for selected product category [](#update-auto-layout-for-selected-product-category)cafe24

PUT /api/v2/admin/autodisplay/{display\_no}

###### PUT

기존 자동 진열을 수정합니다.  
자동진열 최대 상품 수, 예약진열 사용여부 등을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 쓰기권한 (mall.write\_category)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **display\_no**  
**Required** | 

자동진열 번호

 |
| display\_count  

_최소: \[1\]~최대: \[200\]_

 | 

자동진열 최대 상품 수

 |
| use\_reservation | 

예약진열 사용여부

T: 사용함  
F: 사용안함

 |
| start\_date | 

예약 시작일

 |
| use\_hashtag | 

해시태그 사용여부

T: 사용함  
F: 사용안함

 |
| hash\_tags | 

해시태그

 |
| display\_sort | 

정렬순서

정렬 조건(RD, RA, UD, UA, NA, ND, PD, PA, SD, SA, AD, AA, LD, LA)은 use\_hashtag가 "T"일 경우에만 사용 가능

AOD: 주문 수 높은 순서대로  
AOA: 주문 수 낮은 순서대로  
AVD: 조회 수 높은 순서대로  
AVA: 조회 수 낮은 순서대로  
ARD: 주문율 높은 순서대로  
ARA: 주문율 낮은 순서대로  
ACD: 클릭 가치 높은 순서대로  
AND: 신규 등록된 순서대로  
APD: 판매가 높은 순서대로  
APA: 판매가 낮은 순서대로  
RD : 최근 등록상품이 위로  
RA : 최근 등록상품이 아래로  
UD : 최근 수정상품이 위로  
UA : 최근 수정상품이 아래로  
NA : 상품명 가나다순  
ND : 상품명 가나다역순  
PD : 판매가 높은 상품이 위로  
PA : 판매가 높은 상품이 아래로  
SD : 판매량 높은 상품이 위로  
SA : 판매량 높은 상품이 아래로  
CD : 조회수가 높은 상품이 위로  
CA : 조회수가 높은 상품이 아래로  
LD : 좋아요수가 높은 상품이 위로  
LA : 좋아요수가 높은 상품이 아래로

 |
| timetable  

_배열 최대사이즈: \[24\]_

 | 

업데이트 시간

 |
| period | 

데이터 집계 기간

1: 1일  
3: 3일  
7: 1주(7일)  
30: 30일

 |
| except\_categories\_scope | 

제외 분류 설정

A: 모든 분류에 적용  
C : 이 분류만 적용

 |
| except\_categories | 

제외 분류

 |

Update auto layout for selected product category

*   [Update auto layout for selected product category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete auto layout for selected product category [](#delete-auto-layout-for-selected-product-category)cafe24

DELETE /api/v2/admin/autodisplay/{display\_no}

###### DELETE

생성된 자동 진열을 삭제합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 쓰기권한 (mall.write\_category)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **display\_no**  
**Required** | 

자동진열 번호

 |

Delete auto layout for selected product category

*   [Delete auto layout for selected product category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Categories

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Categories.png)  
  
상품분류(Categories)는 쇼핑몰에 노출할 카테고리를 설정하는 기능입니다.  
상품분류는 대분류 하위에 중분류, 소분류, 상세 분류까지 세분화해서 설정할 수 있습니다.  
상품분류 리소스를 사용하면 쇼핑몰의 분류들을 조회하거나 분류를 생성, 수정, 삭제할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/categories
GET /api/v2/admin/categories/count
GET /api/v2/admin/categories/{category_no}
POST /api/v2/admin/categories
PUT /api/v2/admin/categories/{category_no}
DELETE /api/v2/admin/categories/{category_no}
```

#### \[더보기 상세 내용\]

### Categories property list[](#categories-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| category\_no | 

분류 번호

상품분류의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품분류 번호는 중복되지 않음.

 |
| category\_depth  

_최소: \[1\]~최대: \[4\]_

 | 

분류 Depth

해당 상품분류가 하위 몇 차 상품분류에 있는 카테고리인지 표시함. 1~4차까지 상품분류가 존재한다.

 |
| parent\_category\_no | 

부모 분류 번호

해당 상품분류가 2차(중분류), 3차(소분류), 4차(세분류)일 경우 상위에 있는 상품분류의 번호를 표시함.  
  
parent\_category\_no = 1일 경우 해당 분류는 대분류를 의미한다.

 |
| category\_name  

_최대글자수 : \[50자\]_

 | 

분류명

해당 상품분류의 이름을 나타낸다.

 |
| display\_type | 

쇼핑몰 표시설정

해당 상품분류가 PC 쇼핑몰이나 모바일 쇼핑몰, 둘 다에 노출되는지 표시.

A : PC + 모바일  
P : PC  
M : 모바일  
F : 모두 사용안함

 |
| full\_category\_name | 

분류 전체 이름

해당 상품분류가 속해있는 상위 상품분류의 이름을 모두 표시.

 |
| full\_category\_no | 

분류 전체 번호

해당 상품분류가 속해있는 상위 상품분류의 번호를 모두 표시.

 |
| root\_category\_no | 

최상위 분류 번호

해당 상품분류가 속해있는 최상위 상품분류의 분류 번호 표시.

 |
| use\_main | 

메인분류 표시상태

해당 상품분류가 쇼핑몰 메인에 표시되는지 여부. 메인분류에 표시하는 경우 중/소/상세 분류도 대분류처럼 최상위에 표시된다.

T : 표시함  
F : 표시안함

 |
| use\_display | 

표시상태

해당 상품분류의 표시 여부. 표시안함 일 경우 해당 상품분류에 접근할 수 없다.  
  
해당 설정은 멀티쇼핑몰별로 설정할 수 없으며 모든 쇼핑몰에 적용된다.

T : 표시함  
F : 표시안함

 |
| display\_order | 

진열 순서

상품분류를 쇼핑몰 운영자가 배치한 순서.

 |
| soldout\_product\_display | 

품절상품진열

품절 상품을 상품 분류의 맨 앞 또는 맨 뒤에 진열할 것인지 여부  
상품의 품절 여부는 List all products를 통해 sold\_out 파라메터로 알 수 있다.

B : 품절상품 맨 뒤로  
N : 품절상품 상관없음

 |
| sub\_category\_product\_display | 

하위분류 상품진열

현재 상품 분류 하위 분류에 진열된 상품들까지 포함하여 진열할 것인지 여부

T : 진열함  
F : 진열안함

 |
| hashtag\_product\_display | 

쇼핑 큐레이션 해시태그 상품진열

해시태그 상품 진열 기능을 사용할 것인지 여부  
  
※ 해당 기능은 쇼핑 큐레이션 서비스를 사용하는 경우에만 사용 가능하다.

T : 진열함  
F : 진열안함

 |
| hash\_tags | 

쇼핑 큐레이션 해시태그

해당 상품분류의 해시태그 목록  
  
※ 해당 기능은 쇼핑 큐레이션 서비스를 사용하는 경우에만 사용 가능하다.

 |
| product\_display\_scope | 

상품분류 진열영역 구분

상품 분류에 상품을 동일하게 정렬할 것인지, 영역별로 정렬할 것인지 설정  
  
"전체"로 설정된 경우 다음 항목을 통해 정렬 설정 가능하다.  
product\_display\_type  
product\_display\_key  
product\_display\_sort  
product\_display\_period  
  
"영역별"로 설정된 경우 다음 항목을 통해 영역별로 정렬 설정이 가능하다.  
normal\_product\_display\_type  
normal\_product\_display\_key  
normal\_product\_display\_sort  
normal\_product\_display\_period  
recommend\_product\_display\_type  
recommend\_product\_display\_key  
recommend\_product\_display\_sort  
recommend\_product\_display\_period  
new\_product\_display\_type  
new\_product\_display\_key  
new\_product\_display\_sort  
new\_product\_display\_period

A : 전체  
G : 영역별

 |
| product\_display\_type | 

상품분류 진열방법

상품분류 정렬 영역 설정이 "전체"일 경우 해당 상품 분류의 진열 방법

A : 자동정렬  
U : 사용자 지정  
M : 자동정렬 + 사용자 지정

 |
| product\_display\_key | 

상품분류 진열방법 키

상품분류 정렬 영역 설정이 "전체"이고, 상품분류 진열방법이 "자동정렬" 또는 "자동정렬 + 사용자지정"일 경우 해당 상품 분류를 어떤 기준으로 정렬할 것인지 설정

A : 최근 추가된 상품  
R : 최근 등록상품  
U : 최근 수정상품  
N : 상품명 가나다순  
P : 판매가 높은 상품  
S : 판매량 높은 상품  
C : 조회수가 높은 상품  
L : 좋아요수가 높은 상품

 |
| product\_display\_sort | 

상품분류 진열방법 순서

상품분류 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정

D: 내림차순  
A : 오름차순

 |
| product\_display\_period | 

진열순서에 대한 기간

진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간

W : 전체기간  
1D : 1일  
3D : 3일  
7D : 7일  
15D : 15일  
1M : 1개월  
3M : 3개월  
6M : 6개월

 |
| normal\_product\_display\_type | 

상품분류 진열방법

상품분류 정렬 영역 설정이 "영역별"일 경우 일반 상품 영역의 진열 방법

A : 자동정렬  
U : 사용자 지정  
M : 자동정렬 + 사용자 지정

 |
| normal\_product\_display\_key | 

상품분류 진열방법 키

상품분류 정렬 영역 설정이 "영역별"일 경우 일반 상품 영역을 어떤 기준으로 정렬할 것인지 설정

A : 최근 추가된 상품  
R : 최근 등록상품  
U : 최근 수정상품  
N : 상품명 가나다순  
P : 판매가 높은 상품  
S : 판매량 높은 상품  
C : 조회수가 높은 상품  
L : 좋아요수가 높은 상품

 |
| normal\_product\_display\_sort | 

상품분류 진열방법 순서

일반 상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정

D: 내림차순  
A : 오름차순

 |
| normal\_product\_display\_period | 

진열순서에 대한 기간

일반 상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간

W : 전체기간  
1D : 1일  
3D : 3일  
7D : 7일  
15D : 15일  
1M : 1개월  
3M : 3개월  
6M : 6개월

 |
| recommend\_product\_display\_type | 

상품분류 진열방법

상품분류 정렬 영역 설정이 "영역별"일 경우 추천 상품 영역의 진열 방법

A : 자동정렬  
U : 사용자 지정  
M : 자동정렬 + 사용자 지정

 |
| recommend\_product\_display\_key | 

상품분류 진열방법 키

상품분류 정렬 영역 설정이 "영역별"일 경우 추천 상품 영역을 어떤 기준으로 정렬할 것인지 설정

A : 최근 추가된 상품  
R : 최근 등록상품  
U : 최근 수정상품  
N : 상품명 가나다순  
P : 판매가 높은 상품  
S : 판매량 높은 상품  
C : 조회수가 높은 상품  
L : 좋아요수가 높은 상품

 |
| recommend\_product\_display\_sort | 

상품분류 진열방법 순서

추천 상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정

D: 내림차순  
A : 오름차순

 |
| recommend\_product\_display\_period | 

진열순서에 대한 기간

추천 상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간

W : 전체기간  
1D : 1일  
3D : 3일  
7D : 7일  
15D : 15일  
1M : 1개월  
3M : 3개월  
6M : 6개월

 |
| new\_product\_display\_type | 

상품분류 진열방법

상품분류 정렬 영역 설정이 "영역별"일 경우 신상품 영역의 진열 방법

A : 자동정렬  
U : 사용자 지정  
M : 자동정렬 + 사용자 지정

 |
| new\_product\_display\_key | 

상품분류 진열방법 키

상품분류 정렬 영역 설정이 "영역별"일 경우 신상품 영역을 어떤 기준으로 정렬할 것인지 설정

A : 최근 추가된 상품  
R : 최근 등록상품  
U : 최근 수정상품  
N : 상품명 가나다순  
P : 판매가 높은 상품  
S : 판매량 높은 상품  
C : 조회수가 높은 상품  
L : 좋아요수가 높은 상품

 |
| new\_product\_display\_sort | 

상품분류 진열방법 순서

신상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정

D: 내림차순  
A : 오름차순

 |
| new\_product\_display\_period | 

진열순서에 대한 기간

신상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 기준이 되는 기간

W : 전체기간  
1D : 1일  
3D : 3일  
7D : 7일  
15D : 15일  
1M : 1개월  
3M : 3개월  
6M : 6개월

 |
| access\_authority | 

접근권한

F : 모두 이용 가능  
T : 회원만 이용가능  
G : 특정회원등급만 이용 가능  
A : 특정 운영자만 이용 가능

 |

### Retrieve a list of product categories [](#retrieve-a-list-of-product-categories)cafe24

GET /api/v2/admin/categories

###### GET

쇼핑몰에 등록된 분류를 목록으로 조회합니다.  
분류의 분류번호와 분류명 등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 읽기권한 (mall.read\_category)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| category\_depth  

_최소: \[1\]~최대: \[4\]_

 | 

분류 Depth

조회하고자 하는 상품분류의 차수 검색

 |
| category\_no | 

분류 번호

조회하고자 하는 상품분류의 번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| parent\_category\_no | 

부모 분류 번호

조회하고자 하는 상품분류의 부모 상품분류 번호 검색  
  
대분류만 검색하고자 할 경우 parent\_category\_no =1 로 검색한다.

 |
| category\_name | 

분류명

검색어를 분류명에 포함하고 있는 상품분류 검색

 |
| use\_main | 

메인분류 표시상태

T : 표시함  
F : 표시안함

 |
| use\_display | 

표시상태

T : 표시함  
F : 표시안함

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

 |

Retrieve a list of product categories

*   [Retrieve a list of product categories](#none)
*   [Retrieve categories using paging](#none)
*   [Retrieve a specific categories with category\_no parameter](#none)
*   [Retrieve categories with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of product categories [](#retrieve-a-count-of-product-categories)cafe24

GET /api/v2/admin/categories/count

###### GET

쇼핑몰에 등록된 분류의 수를 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 읽기권한 (mall.read\_category)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| category\_depth  

_최소: \[1\]~최대: \[4\]_

 | 

분류 Depth

조회하고자 하는 상품분류의 차수 검색

 |
| category\_no | 

분류 번호

조회하고자 하는 상품분류의 번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| parent\_category\_no | 

부모 분류 번호

조회하고자 하는 상품분류의 부모 상품분류 번호 검색  
  
대분류만 검색하고자 할 경우 parent\_category\_no =1 로 검색한다.

 |
| category\_name | 

분류명

검색어를 분류명에 포함하고 있는 상품분류 검색

 |
| use\_main | 

메인분류 표시상태

T : 표시함  
F : 표시안함

 |
| use\_display | 

표시상태

T : 표시함  
F : 표시안함

 |

Retrieve a count of product categories

*   [Retrieve a count of product categories](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a product category [](#retrieve-a-product-category)cafe24

GET /api/v2/admin/categories/{category\_no}

###### GET

분류번호를 이용하여 해당 분류에 대해 상세조회합니다.  
분류 Depth, 부모 분류 번호, 분류명 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 읽기권한 (mall.read\_category)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **category\_no**  
**Required** | 

분류 번호

조회하고자 하는 상품분류의 번호

 |

Retrieve a product category

*   [Retrieve a product category](#none)
*   [Retrieve a category with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a product category [](#create-a-product-category)cafe24

POST /api/v2/admin/categories

###### POST

쇼핑몰에 분류를 등록합니다.  
분류를 등록하기 위해서는 분류명을 필수로 입력해야합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 쓰기권한 (mall.write\_category)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| parent\_category\_no | 

부모 분류 번호

등록하고자 하는 상품분류의 부모 분류 번호  
  
상품분류를 특정 분류 하위에 등록하고자 할 경우 해당 분류 번호를 입력하여 등록 가능하다.

 |
| **category\_name**  
**Required**  

_최대글자수 : \[50자\]_

 | 

분류명

해당 상품분류의 이름

 |
| shop\_no | 

멀티쇼핑몰 번호

 |
| display\_type | 

쇼핑몰 표시설정

해당 상품분류가 PC 쇼핑몰이나 모바일 쇼핑몰, 둘 다에 노출되는지 설정

A : PC + 모바일  
P : PC  
M : 모바일  
F : 모두 사용안함

 |
| use\_main | 

메인분류 표시상태

해당 상품분류가 쇼핑몰 메인에 표시되는지 여부. 메인분류에 표시하는 경우 중/소/상세 분류도 대분류처럼 최상위에 표시된다.

T : 표시함  
F : 표시안함

 |
| use\_display | 

표시상태

해당 상품분류의 표시 여부. 표시안함 일 경우 해당 상품분류에 접근할 수 없다.  
  
해당 설정은 멀티쇼핑몰별로 설정할 수 없으며 모든 쇼핑몰에 적용된다.

T : 표시함  
F : 표시안함

 |
| soldout\_product\_display | 

품절상품진열

품절 상품을 상품 분류의 맨 앞 또는 맨 뒤에 진열할 것인지 여부

B : 품절상품 맨 뒤로  
N : 품절상품 상관없음

 |
| sub\_category\_product\_display | 

하위분류 상품진열

현재 상품 분류 하위 분류에 진열된 상품들까지 포함하여 진열할 것인지 여부

T : 진열함  
F : 진열안함

 |
| hashtag\_product\_display | 

쇼핑 큐레이션 해시태그 상품진열

해시태그 상품 진열 기능을 사용할 것인지 여부  
  
※ 해당 기능은 쇼핑 큐레이션 서비스를 사용하는 경우에만 사용 가능하다.

T : 진열함  
F : 진열안함

 |
| hash\_tags | 

쇼핑 큐레이션 해시태그

해당 상품분류의 해시태그 목록  
  
※ 해당 기능은 쇼핑 큐레이션 서비스를 사용하는 경우에만 사용 가능하다.

 |
| product\_display\_scope | 

상품분류 진열영역 구분

상품 분류에 상품을 동일하게 정렬할 것인지, 영역별로 정렬할 것인지 설정  
  
"전체"로 설정할 경우 다음 필드는 반드시 입력되어야 한다.  
product\_display\_type  
product\_display\_key  
product\_display\_sort  
product\_display\_period (key가 S, C일 때만 필수)  
  
"영역별"로 설정할 경우 다음 필드는 반드시 입력되어야 한다.  
normal\_product\_display\_type  
normal\_product\_display\_key  
normal\_product\_display\_sort  
normal\_product\_display\_period (key가 S, C일 때만 필수)  
recommend\_product\_display\_type  
recommend\_product\_display\_key  
recommend\_product\_display\_sort  
recommend\_product\_display\_period (key가 S, C일 때만 필수)  
new\_product\_display\_type  
new\_product\_display\_key  
new\_product\_display\_sort  
new\_product\_display\_period (key가 S, C일 때만 필수)

A : 전체  
G : 영역별

 |
| product\_display\_type | 

상품분류 진열방법

상품분류 정렬 영역 설정이 "전체"일 경우 해당 상품 분류의 진열 방법

A : 자동정렬  
U : 사용자 지정  
M : 자동정렬 + 사용자 지정

 |
| product\_display\_key | 

상품분류 진열방법 키

상품분류 정렬 영역 설정이 "전체"이고, 상품분류 진열방법이 "자동정렬" 또는 "자동정렬 + 사용자지정"일 경우 해당 상품 분류를 어떤 기준으로 정렬할 것인지 설정

A : 최근 추가된 상품  
R : 최근 등록상품  
U : 최근 수정상품  
N : 상품명 가나다순  
P : 판매가 높은 상품  
S : 판매량 높은 상품  
C : 조회수가 높은 상품  
L : 좋아요수가 높은 상품

 |
| product\_display\_sort | 

상품분류 진열방법 순서

상품분류 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정

D: 내림차순  
A : 오름차순

 |
| product\_display\_period | 

진열순서에 대한 기간

진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간

W : 전체기간  
1D : 1일  
3D : 3일  
7D : 7일  
15D : 15일  
1M : 1개월  
3M : 3개월  
6M : 6개월

 |
| normal\_product\_display\_type | 

상품분류 진열방법

상품분류 정렬 영역 설정이 "영역별"일 경우 일반 상품 영역의 진열 방법

A : 자동정렬  
U : 사용자 지정  
M : 자동정렬 + 사용자 지정

 |
| normal\_product\_display\_key | 

상품분류 진열방법 키

상품분류 정렬 영역 설정이 "영역별"일 경우 일반 상품 영역을 어떤 기준으로 정렬할 것인지 설정

A : 최근 추가된 상품  
R : 최근 등록상품  
U : 최근 수정상품  
N : 상품명 가나다순  
P : 판매가 높은 상품  
S : 판매량 높은 상품  
C : 조회수가 높은 상품  
L : 좋아요수가 높은 상품

 |
| normal\_product\_display\_sort | 

상품분류 진열방법 순서

일반 상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정

D: 내림차순  
A : 오름차순

 |
| normal\_product\_display\_period | 

진열순서에 대한 기간

일반 상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간

W : 전체기간  
1D : 1일  
3D : 3일  
7D : 7일  
15D : 15일  
1M : 1개월  
3M : 3개월  
6M : 6개월

 |
| recommend\_product\_display\_type | 

상품분류 진열방법

상품분류 정렬 영역 설정이 "영역별"일 경우 추천 상품 영역의 진열 방법

A : 자동정렬  
U : 사용자 지정  
M : 자동정렬 + 사용자 지정

 |
| recommend\_product\_display\_key | 

상품분류 진열방법 키

상품분류 정렬 영역 설정이 "영역별"일 경우 추천 상품 영역을 어떤 기준으로 정렬할 것인지 설정

A : 최근 추가된 상품  
R : 최근 등록상품  
U : 최근 수정상품  
N : 상품명 가나다순  
P : 판매가 높은 상품  
S : 판매량 높은 상품  
C : 조회수가 높은 상품  
L : 좋아요수가 높은 상품

 |
| recommend\_product\_display\_sort | 

상품분류 진열방법 순서

추천 상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정

D: 내림차순  
A : 오름차순

 |
| recommend\_product\_display\_period | 

진열순서에 대한 기간

추천 상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간

W : 전체기간  
1D : 1일  
3D : 3일  
7D : 7일  
15D : 15일  
1M : 1개월  
3M : 3개월  
6M : 6개월

 |
| new\_product\_display\_type | 

상품분류 진열방법

상품분류 정렬 영역 설정이 "영역별"일 경우 신상품 영역의 진열 방법

A : 자동정렬  
U : 사용자 지정  
M : 자동정렬 + 사용자 지정

 |
| new\_product\_display\_key | 

상품분류 진열방법 키

상품분류 정렬 영역 설정이 "영역별"일 경우 신상품 영역을 어떤 기준으로 정렬할 것인지 설정

A : 최근 추가된 상품  
R : 최근 등록상품  
U : 최근 수정상품  
N : 상품명 가나다순  
P : 판매가 높은 상품  
S : 판매량 높은 상품  
C : 조회수가 높은 상품  
L : 좋아요수가 높은 상품

 |
| new\_product\_display\_sort | 

상품분류 진열방법 순서

신상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정

D: 내림차순  
A : 오름차순

 |
| new\_product\_display\_period | 

진열순서에 대한 기간

신상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간

W : 전체기간  
1D : 1일  
3D : 3일  
7D : 7일  
15D : 15일  
1M : 1개월  
3M : 3개월  
6M : 6개월

 |

Create a product category

*   [Create a product category](#none)
*   [Create a category using only category\_name field](#none)
*   [Try creating a category without category\_name field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a product category [](#update-a-product-category)cafe24

PUT /api/v2/admin/categories/{category\_no}

###### PUT

분류번호를 이용하여 쇼핑몰에 등록된 분류를 수정합니다.  
분류명이나 표시상태 등을 변경할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 쓰기권한 (mall.write\_category)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **category\_no**  
**Required** | 

분류 번호

 |
| category\_name  

_최대글자수 : \[50자\]_

 | 

분류명

해당 상품분류의 이름

 |
| shop\_no | 

멀티쇼핑몰 번호

 |
| display\_type | 

쇼핑몰 표시설정

해당 상품분류가 PC 쇼핑몰이나 모바일 쇼핑몰, 둘 다에 노출되는지 설정

A : PC + 모바일  
P : PC  
M : 모바일  
F : 모두 사용안함

 |
| use\_main | 

메인분류 표시상태

해당 상품분류가 쇼핑몰 메인에 표시되는지 여부. 메인분류에 표시하는 경우 중/소/상세 분류도 대분류처럼 최상위에 표시된다.

T : 표시함  
F : 표시안함

 |
| use\_display | 

표시상태

해당 상품분류의 표시 여부. 표시안함 일 경우 해당 상품분류에 접근할 수 없다.  
  
해당 설정은 멀티쇼핑몰별로 설정할 수 없으며 모든 쇼핑몰에 적용된다.

T : 표시함  
F : 표시안함

 |
| soldout\_product\_display | 

품절상품진열

품절 상품을 상품 분류의 맨 앞 또는 맨 뒤에 진열할 것인지 여부

B : 품절상품 맨 뒤로  
N : 품절상품 상관없음

 |
| sub\_category\_product\_display | 

하위분류 상품진열

현재 상품 분류 하위 분류에 진열된 상품들까지 포함하여 진열할 것인지 여부

T : 진열함  
F : 진열안함

 |
| hashtag\_product\_display | 

쇼핑 큐레이션 해시태그 상품진열

해시태그 상품 진열 기능을 사용할 것인지 여부  
  
※ 해당 기능은 쇼핑 큐레이션 서비스를 사용하는 경우에만 사용 가능하다.

T : 진열함  
F : 진열안함

 |
| hash\_tags | 

쇼핑 큐레이션 해시태그

해당 상품분류의 해시태그 목록  
  
※ 해당 기능은 쇼핑 큐레이션 서비스를 사용하는 경우에만 사용 가능하다.

 |
| product\_display\_scope | 

상품분류 진열영역 구분

상품 분류에 상품을 동일하게 정렬할 것인지, 영역별로 정렬할 것인지 설정  
  
"전체"로 설정할 경우 다음 필드는 반드시 입력되어야 한다.  
product\_display\_type  
product\_display\_key  
product\_display\_sort  
product\_display\_period (key가 S, C일 때만 필수)  
  
"영역별"로 설정할 경우 다음 필드는 반드시 입력되어야 한다.  
normal\_product\_display\_type  
normal\_product\_display\_key  
normal\_product\_display\_sort  
normal\_product\_display\_period (key가 S, C일 때만 필수)  
recommend\_product\_display\_type  
recommend\_product\_display\_key  
recommend\_product\_display\_sort  
recommend\_product\_display\_period (key가 S, C일 때만 필수)  
new\_product\_display\_type  
new\_product\_display\_key  
new\_product\_display\_sort  
new\_product\_display\_period (key가 S, C일 때만 필수)

A : 전체  
G : 영역별

 |
| product\_display\_type | 

상품분류 진열방법

상품분류 정렬 영역 설정이 "전체"일 경우 해당 상품 분류의 진열 방법

A : 자동정렬  
U : 사용자 지정  
M : 자동정렬 + 사용자 지정

 |
| product\_display\_key | 

상품분류 진열방법 키

상품분류 정렬 영역 설정이 "전체"이고, 상품분류 진열방법이 "자동정렬" 또는 "자동정렬 + 사용자지정"일 경우 해당 상품 분류를 어떤 기준으로 정렬할 것인지 설정

A : 최근 추가된 상품  
R : 최근 등록상품  
U : 최근 수정상품  
N : 상품명 가나다순  
P : 판매가 높은 상품  
S : 판매량 높은 상품  
C : 조회수가 높은 상품  
L : 좋아요수가 높은 상품

 |
| product\_display\_sort | 

상품분류 진열방법 순서

상품분류 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정

D: 내림차순  
A : 오름차순

 |
| product\_display\_period | 

진열순서에 대한 기간

진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간

W : 전체기간  
1D : 1일  
3D : 3일  
7D : 7일  
15D : 15일  
1M : 1개월  
3M : 3개월  
6M : 6개월

 |
| normal\_product\_display\_type | 

상품분류 진열방법

상품분류 정렬 영역 설정이 "영역별"일 경우 일반 상품 영역의 진열 방법

A : 자동정렬  
U : 사용자 지정  
M : 자동정렬 + 사용자 지정

 |
| normal\_product\_display\_key | 

상품분류 진열방법 키

상품분류 정렬 영역 설정이 "영역별"일 경우 일반 상품 영역을 어떤 기준으로 정렬할 것인지 설정

A : 최근 추가된 상품  
R : 최근 등록상품  
U : 최근 수정상품  
N : 상품명 가나다순  
P : 판매가 높은 상품  
S : 판매량 높은 상품  
C : 조회수가 높은 상품  
L : 좋아요수가 높은 상품

 |
| normal\_product\_display\_sort | 

상품분류 진열방법 순서

일반 상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정

D: 내림차순  
A : 오름차순

 |
| normal\_product\_display\_period | 

진열순서에 대한 기간

일반 상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간

W : 전체기간  
1D : 1일  
3D : 3일  
7D : 7일  
15D : 15일  
1M : 1개월  
3M : 3개월  
6M : 6개월

 |
| recommend\_product\_display\_type | 

상품분류 진열방법

상품분류 정렬 영역 설정이 "영역별"일 경우 추천 상품 영역의 진열 방법

A : 자동정렬  
U : 사용자 지정  
M : 자동정렬 + 사용자 지정

 |
| recommend\_product\_display\_key | 

상품분류 진열방법 키

상품분류 정렬 영역 설정이 "영역별"일 경우 추천 상품 영역을 어떤 기준으로 정렬할 것인지 설정

A : 최근 추가된 상품  
R : 최근 등록상품  
U : 최근 수정상품  
N : 상품명 가나다순  
P : 판매가 높은 상품  
S : 판매량 높은 상품  
C : 조회수가 높은 상품  
L : 좋아요수가 높은 상품

 |
| recommend\_product\_display\_sort | 

상품분류 진열방법 순서

추천 상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정

D: 내림차순  
A : 오름차순

 |
| recommend\_product\_display\_period | 

진열순서에 대한 기간

추천 상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간

W : 전체기간  
1D : 1일  
3D : 3일  
7D : 7일  
15D : 15일  
1M : 1개월  
3M : 3개월  
6M : 6개월

 |
| new\_product\_display\_type | 

상품분류 진열방법

상품분류 정렬 영역 설정이 "영역별"일 경우 신상품 영역의 진열 방법

A : 자동정렬  
U : 사용자 지정  
M : 자동정렬 + 사용자 지정

 |
| new\_product\_display\_key | 

상품분류 진열방법 키

상품분류 정렬 영역 설정이 "영역별"일 경우 신상품 영역을 어떤 기준으로 정렬할 것인지 설정

A : 최근 추가된 상품  
R : 최근 등록상품  
U : 최근 수정상품  
N : 상품명 가나다순  
P : 판매가 높은 상품  
S : 판매량 높은 상품  
C : 조회수가 높은 상품  
L : 좋아요수가 높은 상품

 |
| new\_product\_display\_sort | 

상품분류 진열방법 순서

신상품 영역의 진열 방법을 내림차순으로 할지, 오름차순으로 할지 설정

D: 내림차순  
A : 오름차순

 |
| new\_product\_display\_period | 

진열순서에 대한 기간

신상품 영역의 진열 방법이 판매량 높은 상품(S), 조회수가 높은 상품(C) 일 경우 기준이 되는 기간

W : 전체기간  
1D : 1일  
3D : 3일  
7D : 7일  
15D : 15일  
1M : 1개월  
3M : 3개월  
6M : 6개월

 |

Update a product category

*   [Update a product category](#none)
*   [Update the categories name](#none)
*   [Update the categoies hidden](#none)
*   [Set the category display setting of all section](#none)
*   [Set the category display setting by section](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a product category [](#delete-a-product-category)cafe24

DELETE /api/v2/admin/categories/{category\_no}

###### DELETE

분류번호를 이용하여 쇼핑몰에 등록된 분류를 삭제합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 쓰기권한 (mall.write\_category)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **category\_no**  
**Required** | 
분류 번호

 |

Delete a product category

*   [Delete a product category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Categories decorationimages

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Categories%20decorationimages.png)  
  
카테고리 꾸미기 이미지(Categories decorationimages)는 특정 카테고리의 꾸미기 이미지에 관한 기능입니다.  
특정 카테고리에 설정된 꾸미기 이미지를 조회하거나 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/categories/{category_no}/decorationimages
PUT /api/v2/admin/categories/{category_no}/decorationimages
```

#### \[더보기 상세 내용\]

### Categories decorationimages property list[](#categories__decorationimages-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| category\_no | 

분류 번호

 |
| use\_menu\_image\_pc | 

분류 PC 메뉴 이미지 사용여부

T : 사용함  
F : 사용안함

 |
| menu\_image\_pc | 

분류 PC 메뉴 기본 이미지

 |
| menu\_over\_image\_pc | 

분류 PC 메뉴 오버 이미지

 |
| use\_top\_image\_pc | 

분류 PC 상단 이미지 사용여부

T : 사용함  
F : 사용안함

 |
| top\_images\_pc | 

분류 PC 상단 이미지

 |
| use\_title\_image\_pc | 

분류 PC 타이틀 이미지 사용여부

T : 사용함  
F : 사용안함

 |
| title\_image\_pc | 

분류 PC 타이틀 이미지

 |
| use\_menu\_image\_mobile | 

분류 모바일 메뉴 이미지 사용여부

T : 사용함  
F : 사용안함

 |
| menu\_image\_mobile | 

분류 모바일 메뉴 기본 이미지

 |
| use\_top\_image\_mobile | 

분류 모바일 상단 이미지 사용여부

T : 사용함  
F : 사용안함

 |
| top\_images\_mobile  

_배열 최대사이즈: \[3\]_

 | 

분류 모바일 상단 이미지

 |
| use\_title\_image\_mobile | 

분류 모바일 타이틀 이미지 사용여부

T : 사용함  
F : 사용안함

 |
| title\_image\_mobile | 

분류 모바일 타이틀 이미지

 |

### Retrieve decoration image settings by category [](#retrieve-decoration-image-settings-by-category)cafe24

GET /api/v2/admin/categories/{category\_no}/decorationimages

###### GET

분류번호를 이용하여 해당 분류의 꾸미기 정보를 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 읽기권한 (mall.read\_category)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **category\_no**  
**Required** | 

분류 번호

 |

Retrieve decoration image settings by category

*   [Retrieve decoration image settings by category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update decoration images of a product category [](#update-decoration-images-of-a-product-category)cafe24

PUT /api/v2/admin/categories/{category\_no}/decorationimages

###### PUT

분류번호를 이용하여 해당 분류의 꾸미기 정보를 수정합니다.  
분류 PC 메뉴 이미지 사용여부, 기본이미지 등을 변경할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 쓰기권한 (mall.write\_category)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **category\_no**  
**Required** | 

분류 번호

 |
| use\_menu\_image\_pc | 

분류 PC 메뉴 이미지 사용여부

T : 사용함  
F : 사용안함

 |
| menu\_image\_pc | 

분류 PC 메뉴 기본 이미지

 |
| menu\_over\_image\_pc | 

분류 PC 메뉴 오버 이미지

 |
| use\_top\_image\_pc | 

분류 PC 상단 이미지 사용여부

T : 사용함  
F : 사용안함

 |
| top\_images\_pc  

_배열 최대사이즈: \[3\]_

 | 

분류 PC 상단 이미지

 |
| use\_title\_image\_pc | 

분류 PC 타이틀 이미지 사용여부

T : 사용함  
F : 사용안함

 |
| title\_image\_pc | 

분류 PC 타이틀 이미지

 |
| use\_menu\_image\_mobile | 

분류 모바일 메뉴 이미지 사용여부

T : 사용함  
F : 사용안함

 |
| menu\_image\_mobile | 

분류 모바일 메뉴 기본 이미지

 |
| use\_top\_image\_mobile | 

분류 모바일 상단 이미지 사용여부

T : 사용함  
F : 사용안함

 |
| top\_images\_mobile  

_배열 최대사이즈: \[3\]_

 | 

분류 모바일 상단 이미지

 |
| use\_title\_image\_mobile | 

분류 모바일 타이틀 이미지 사용여부

T : 사용함  
F : 사용안함

 |
| title\_image\_mobile | 

분류 모바일 타이틀 이미지

 |

Update decoration images of a product category

*   [Update decoration images of a product category](#none)
*   [Disable all PC decoration images of the category](#none)
*   [Update the PC and mobile decoration image of the category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Categories seo

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Categories%20seo.png)  
  
카테고리 SEO(Categories seo)는 특정 카테고리의 SEO 에 대한 설정과 설정값의 조회가 가능한 기능입니다.  
SEO는 검색엔진 최적화(Search Engine Optimization)의 약자로서 본 기능을 활용하여 검색엔진에 카테고리나 쇼핑몰이 더 잘 검색될 수 있도록 할 수 있습니다.  
카테고리 SEO는 카테고리의의 하위 리소스로서 특정 카테고리의 검색엔진 최적화 설정을 할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/categories/{category_no}/seo
PUT /api/v2/admin/categories/{category_no}/seo
```

#### \[더보기 상세 내용\]

### Categories seo property list[](#categories__seo-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| category\_no | 

분류 번호

 |
| search\_engine\_exposure | 

검색 엔진 노출 설정

T : 사용함  
F : 사용안함

 |
| meta\_title | 

브라우저 타이틀

 |
| meta\_author | 

메타태그1 : Author

 |
| meta\_description | 

메타태그2 : Description

 |
| meta\_keywords | 

메타태그3 : Keywords

 |

### Retrieve SEO settings by category [](#retrieve-seo-settings-by-category)cafe24

GET /api/v2/admin/categories/{category\_no}/seo

###### GET

특정 카테고리의 SEO 설정을 조회할 수 있습니다.  
검색 엔진 노출 설정, 브라우저 타이틀 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 읽기권한 (mall.read\_category)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **category\_no**  
**Required** | 

분류 번호

 |

Retrieve SEO settings by category

*   [Retrieve SEO settings by category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a product category SEO [](#update-a-product-category-seo)cafe24

PUT /api/v2/admin/categories/{category\_no}/seo

###### PUT

특정 카테고리의 SEO 설정을 수정할 수 있습니다.  
검색 엔진 노출 설정, 브라우저 타이틀 등을 설정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 쓰기권한 (mall.write\_category)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| shop\_no | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **category\_no**  
**Required** | 

분류 번호

 |
| search\_engine\_exposure | 

검색 엔진 노출 설정

T : 사용함  
F : 사용안함

 |
| meta\_title | 

브라우저 타이틀

 |
| meta\_author | 

메타태그1 : Author

 |
| meta\_description | 

메타태그2 : Description

 |
| meta\_keywords | 

메타태그3 : Keywords

 |

Update a product category SEO

*   [Update a product category SEO](#none)
*   [Update the categories's search engine exposure to hidden](#none)
*   [Update the categorie's title and meta tags](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Mains

메인분류(Mains)는 쇼핑몰의 상품을 메인화면에 진열할 수 있는 기능입니다.

> Endpoints

```
GET /api/v2/admin/mains
POST /api/v2/admin/mains
PUT /api/v2/admin/mains/{display_group}
DELETE /api/v2/admin/mains/{display_group}
```

#### \[더보기 상세 내용\]

### Mains property list[](#mains-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| module\_code | 

모듈 코드

각 메인분류에 지정된 모듈 코드

 |
| display\_group | 

메인분류 번호

 |
| group\_name | 

메인분류 명

메인분류 생성 당시 지정한 분류명

 |
| soldout\_sort\_type | 

품절상품진열

품절상품을 진열할 위치

 |
| use\_autodisplay | 

자동진열

T : 사용함  
F : 사용안함

 |

### Retrieve a list of main categories [](#retrieve-a-list-of-main-categories)cafe24

GET /api/v2/admin/mains

###### GET

쇼핑몰에 진열된 메인분류들의 정보를 조회할 수 있습니다.  
메인분류 번호, 메인분류 명, 품절상품진열 설정을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 읽기권한 (mall.read\_category)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve a list of main categories

*   [Retrieve a list of main categories](#none)
*   [Retrieve mains with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Add main category [](#add-main-category)cafe24

POST /api/v2/admin/mains

###### POST

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 쓰기권한 (mall.write\_category)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **group\_name**  
**Required**  

_최대글자수 : \[50자\]_

 | 

메인분류 명

 |
| soldout\_sort\_type | 

품절상품진열

B : 품절상품 맨 뒤로  
N : 품절상품 상관없음

DEFAULT N

 |

Add main category

*   [Add main category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update main category [](#update-main-category)cafe24

PUT /api/v2/admin/mains/{display\_group}

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 쓰��권한 (mall.write\_category)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **display\_group**  
**Required** | 

메인분류 번호

 |
| group\_name  

_최대글자수 : \[50자\]_

 | 

메인분류 명

 |
| soldout\_sort\_type | 

품절상품진열

B : 품절상품 맨 뒤로  
N : 품절상품 상관없음

 |

Update main category

*   [Update main category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete main category [](#delete-main-category)cafe24

DELETE /api/v2/admin/mains/{display\_group}

###### DELETE

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **상품분류 쓰기권한 (mall.write\_category)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **display\_group**  
**Required** | 

메인분류 번호

 |

Delete main category

*   [Delete main category](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Collection

## Brands

브랜드(Brands)는 쇼핑몰 상품의 "브랜드"를 나타냅니다.  
브랜드는 쇼핑몰의 상품을 구분하는 판매분류의 하나로, 상품은 반드시 하나의 브랜드를 갖고 있습니다.  
브랜드가 미지정된 경우 "자체브랜드"를 사용합니다.

> Endpoints

```
GET /api/v2/admin/brands
GET /api/v2/admin/brands/count
POST /api/v2/admin/brands
PUT /api/v2/admin/brands/{brand_code}
DELETE /api/v2/admin/brands/{brand_code}
```

#### \[더보기 상세 내용\]

### Brands property list[](#brands-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| brand\_code | 

브랜드 코드

 |
| brand\_name  

_최대글자수 : \[50자\]_

 | 

브랜드 명

 |
| use\_brand | 

브랜드 사용여부

T : 사용함  
F : 사용안함

 |
| search\_keyword  

_최대글자수 : \[200자\]_

 | 

검색어 설정

 |
| product\_count | 

상품수

 |
| created\_date | 

생성일

 |

### Retrieve a list of brands [](#retrieve-a-list-of-brands)cafe24 youtube

GET /api/v2/admin/brands

###### GET

현재 쇼핑몰에 있는 브랜드를 조회할 수 있습니다.  
브랜드명, 브랜드 사용여부, 상품수 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 읽기권한 (mall.read\_collection)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| brand\_code | 

브랜드 코드

,(콤마)로 여러 건을 검색할 수 있다.

 |
| brand\_name | 

브랜드 명

,(콤마)로 여러 건을 검색할 수 있다.

 |
| use\_brand | 

브랜드 사용여부

T : 사용함  
F : 사용안함

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

 |

Retrieve a list of brands

*   [Retrieve a list of brands](#none)
*   [Retrieve brands with fields parameter](#none)
*   [Retrieve brands using paging](#none)
*   [Retrieve a specific brands with brand\_code parameter](#none)
*   [Retrieve multiple brands](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of brands [](#retrieve-a-count-of-brands)cafe24 youtube

GET /api/v2/admin/brands/count

###### GET

현재 쇼핑몰에 있는 브랜드의 숫자를 카운트합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 읽기권한 (mall.read\_collection)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| brand\_code | 

브랜드 코드

,(콤마)로 여러 건을 검색할 수 있다.

 |
| brand\_name | 

브랜드 명

,(콤마)로 여러 건을 검색할 수 있다.

 |
| use\_brand | 

브랜드 사용여부

T : 사용함  
F : 사용안함

 |

Retrieve a count of brands

*   [Retrieve a count of brands](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a brand [](#create-a-brand)cafe24 youtube

POST /api/v2/admin/brands

###### POST

브랜드를 생성합니다.  
브랜드 명과 브랜드 사용 여부 등을 설정할 수 있으며, 상품 검색시 해당 브랜드 상품이 검색될 수 있도록 검색어를 지정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 쓰기권한 (mall.write\_collection)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **brand\_name**  
**Required** | 

브랜드 ���

 |
| use\_brand | 

브랜드 사용여부

T : 사용함  
F : 사용안함

DEFAULT T

 |
| search\_keyword  

_최대글자수 : \[200자\]_

 | 

검색어 설정

 |

Create a brand

*   [Create a brand](#none)
*   [Create a brand using only brand\_name field](#none)
*   [Try creating a brand without brand\_name field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a brand [](#update-a-brand)cafe24 youtube

PUT /api/v2/admin/brands/{brand\_code}

###### PUT

특정 브랜드의 정보를 수정할 수 있습니다.  
브랜드명, 브랜드 사용여부 등을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 쓰기권한 (mall.write\_collection)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| shop\_no | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **brand\_code**  
**Required**  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

브랜드 코드

 |
| brand\_name | 

브랜드 명

 |
| use\_brand | 

브랜드 사용여부

T : 사용함  
F : 사용안함

DEFAULT T

 |
| search\_keyword  

_최대글자수 : \[200자\]_

 | 

검색어 설정

 |

Update a brand

*   [Update a brand](#none)
*   [Update the brand name](#none)
*   [Disable the brand](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a brand [](#delete-a-brand)cafe24 youtube

DELETE /api/v2/admin/brands/{brand\_code}

###### DELETE

특정 브랜드를 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 쓰기권한 (mall.write\_collection)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **brand\_code**  
**Required**  
_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

브랜드 코드

 |

Delete a brand

*   [Delete a brand](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Classifications

자체분류(Classifications)는 상품등록시 사용할 자체분류에 입력하는 정보를 의미합니다.  
자체분류는 상품을 구분하는 판매분류의 하나이며, 상품은 반드시 하나의 자체분류를 가지고 있습니다.

> Endpoints

```
GET /api/v2/admin/classifications
GET /api/v2/admin/classifications/count
```

#### \[더보기 상세 내용\]

### Classifications property list[](#classifications-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| classification\_code  

_형식 : \[A-Z0-9\]_  
_최소글자수 : \[8자\]_  
_최대글자수 : \[8자\]_

 | 

자체분류 코드

 |
| classification\_name  

_최대글자수 : \[200자\]_

 | 

자체분류 명

 |
| classification\_description  

_최대글자수 : \[300자\]_

 | 

자체분류 설명

 |
| use\_classification | 

사용여부

 |
| created\_date | 

생성일

 |
| product\_count | 

상품수

 |

### Retrieve a list of custom categories [](#retrieve-a-list-of-custom-categories)cafe24

GET /api/v2/admin/classifications

###### GET

쇼핑몰에 등록된 자체분류를 목록으로 조회합니다.  
자체분류의 분류코드와 분류명 등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 읽기권한 (mall.read\_collection)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| classification\_code | 

자체분류 코드

,(콤마)로 여러 건을 검색할 수 있다.

 |
| classification\_name | 

자체분류 명

,(콤마)로 여러 건을 검색할 수 있다.

 |
| use\_classification | 

사용여부

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

 |

Retrieve a list of custom categories

*   [Retrieve a list of custom categories](#none)
*   [Retrieve classifications with fields parameter](#none)
*   [Retrieve classifications using paging](#none)
*   [Retrieve a specific classifications with classification\_code parameter](#none)
*   [Retrieve multiple classifications](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of custom categories [](#retrieve-a-count-of-custom-categories)cafe24

GET /api/v2/admin/classifications/count

###### GET

쇼핑몰에 등록된 자체분류의 수를 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 읽기권한 (mall.read\_collection)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| classification\_code | 

자체분류 코드

,(콤마)로 여러 건을 검색할 수 있다.

 |
| classification\_name | 

자체분류 명

,(콤마)로 여러 건을 검색할 수 있다.

 |
| use\_classification | 

사용여부

 |

Retrieve a count of custom categories

*   [Retrieve a count of custom categories](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Manufacturers

제조사(Manufacturers)는 상품의 제작정보 중 제조사에 입력하는 정보입니다.  
제조사는 상품을 제작, 생산한 주체를 나타내며, 상품을 구분하는 판매분류 중 하나입니다.  
상품은 반드시 하나의 제조사를 갖고 있습니다.(미지정시 '자체제작'을 사용함)  
제조사의 목록조회, 수 조회, 상세조회, 생성, 수정이 가능합니다.

> Endpoints

```
GET /api/v2/admin/manufacturers
GET /api/v2/admin/manufacturers/{manufacturer_code}
GET /api/v2/admin/manufacturers/count
POST /api/v2/admin/manufacturers
PUT /api/v2/admin/manufacturers/{manufacturer_code}
```

#### \[더보기 상세 내용\]

### Manufacturers property list[](#manufacturers-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| manufacturer\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

제조사 코드

시스템이 부여한 제조사의 코드. 해당 쇼핑몰 내에서 제조사 코드는 중복되지 않는다.

 |
| manufacturer\_name  

_최대글자수 : \[50자\]_

 | 

제조사명

제조사의 이름. 제조사명은 쇼핑몰 관리자 화면에서 제조사를 구분할 수 있는 기본적인 정보이다.

 |
| president\_name  

_최대글자수 : \[30자\]_

 | 

대표자명

제조사의 대표자 이름.

 |
| use\_manufacturer | 

사용여부

해당 제조사를 사용하는지 여부 표시

T : 사용함  
F : 사용안함

 |
| email  

_최대글자수 : \[255자\]_

 | 

이메일

제조사의 문의 메일.

 |
| phone  

_최대글자수 : \[20자\]_

 | 

전화번호

제조사의 전화번호.

 |
| homepage  

_최대글자수 : \[255자\]_

 | 

홈페이지

제조사의 홈페이지 주소

 |
| zipcode | 

우편번호

제조사의 사업장 우편번호.

 |
| country\_code | 

국가코드

 |
| address1  

_최대글자수 : \[255자\]_

 | 

기본 주소

제조사의 사업장 주소(시/군/구 단위 표기)

 |
| address2  

_최대글자수 : \[255자\]_

 | 

상세 주소

제조사의 사업장 주소(상세 주소 표기)

 |
| created\_date | 

생성일

 |

### Retrieve a list of manufacturers [](#retrieve-a-list-of-manufacturers)cafe24 youtube

GET /api/v2/admin/manufacturers

###### GET

쇼핑몰에 등록된 제조사들의 정보를 목록으로 조회합니다.  
제조사명, 대표자명, 전화번호 등을 조회할 수 있습니다.  
목록조회의 응답값은 상세조회보다 간소합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 읽기권한 (mall.read\_collection)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| manufacturer\_code | 

제조사 코드

조회하고자 하는 제조사의 코드.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| manufacturer\_name | 

제조사명

,(콤마)로 여러 건을 검색할 수 있다.

 |
| use\_manufacturer | 

제조사 사용여부

T : 사용함  
F : 사용안함

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

 |

Retrieve a list of manufacturers

*   [Retrieve a list of manufacturers](#none)
*   [Retrieve manufacturers with fields parameter](#none)
*   [Retrieve manufacturers using paging](#none)
*   [Retrieve a specific manufacturers with manufacturer\_code parameter](#none)
*   [Retrieve multiple manufacturers](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a manufacturer [](#retrieve-a-manufacturer)cafe24 youtube

GET /api/v2/admin/manufacturers/{manufacturer\_code}

###### GET

쇼핑몰에 등록된 제조사의 상세정보를 조회합니다.  
제조사명, 대표자명, 제조사 사용여부 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 읽기권한 (mall.read\_collection)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **manufacturer\_code**  
**Required**  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

제조사 코드

 |

Retrieve a manufacturer

*   [Retrieve a manufacturer](#none)
*   [Retrieve a manufacturer with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of manufacturers [](#retrieve-a-count-of-manufacturers)cafe24 youtube

GET /api/v2/admin/manufacturers/count

###### GET

쇼핑몰에 등록된 제조사의 수를 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 읽기권한 (mall.read\_collection)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| manufacturer\_code | 

제조사 코드

조회하고자 하는 제조사의 코드.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| manufacturer\_name | 

제조사명

검색어를 제조사명에 포함하고 있는 공급사 검색(대소문자 구분 없음)

,(콤마)로 여러 건을 검색할 수 있다.

 |
| use\_manufacturer | 

제조사 사용여부

T : 사용함  
F : 사용안함

 |

Retrieve a count of manufacturers

*   [Retrieve a count of manufacturers](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a manufacturer [](#create-a-manufacturer)cafe24 youtube

POST /api/v2/admin/manufacturers

###### POST

쇼핑몰에 제조사를 새로 등록합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 쓰기권한 (mall.write\_collection)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **manufacturer\_name**  
**Required** | 

제조사명

 |
| **president\_name**  
**Required**  

_최대글자수 : \[30자\]_

 | 

대표자명

 |
| email  

_최대글자수 : \[255자\]_  
_이메일_

 | 

이메일

 |
| phone  

_최대글자수 : \[20자\]_  
_전화번호_

 | 

전화번호

 |
| homepage  

_최대글자수 : \[255자\]_

 | 

홈페이지

 |
| zipcode | 

우편번호

 |
| address1  

_최대글자수 : \[255자\]_

 | 

기본 주소

 |
| address2  

_최대글자수 : \[255자\]_

 | 

상세 주소

 |
| country\_code | 

국가코드

 |
| use\_manufacturer | 

사용여부

T : 사용함  
F : 사용안함

 |

Create a manufacturer

*   [Create a manufacturer](#none)
*   [Create a manufacturer using only manufacturer\_name and president\_name fields](#none)
*   [Try creating a manufacturer without manufacturer\_name field](#none)
*   [Try creating a manufacturer without president\_name field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a manufacturer [](#update-a-manufacturer)cafe24 youtube

PUT /api/v2/admin/manufacturers/{manufacturer\_code}

###### PUT

쇼핑몰에 등록된 제조사의 정보를 수정합니다.  
제조사명, 대표자명, 전화번호 등을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 쓰기권한 (mall.write\_collection)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **manufacturer\_code**  
**Required**  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

제조사 코드

 |
| manufacturer\_name | 

제조사명

 |
| president\_name | 

대표자명

 |
| email  

_최대글자수 : \[255자\]_  
_이메일_

 | 

이메일

 |
| phone  

_최대글자수 : \[20자\]_  
_전화번호_

 | 

전화번호

 |
| homepage  

_최대글자수 : \[255자\]_

 | 

홈페이지

 |
| zipcode | 

우편번호

 |
| address1  

_최대글자수 : \[255자\]_

 | 

기본 주소

 |
| address2  

_최대글자수 : \[255자\]_

 | 

상세 주소

 |
| country\_code | 

국가코드

 |
| use\_manufacturer | 

사용여부

T : 사용함  
F : 사용안함

 |

Update a manufacturer

*   [Update a manufacturer](#none)
*   [Update the manufacturer name](#none)
*   [Disable the manufacturer](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Origin

원산지(Origin)는 상품정보에 포함되는 데이터로 상품이 생산된 지역을 의미합니다.  
원산지는 국외 배송 등 경우에 따라 중요한 데이터가 될 수 있습니다.  
카페24는 다양한 원산지가 코드화 되어있으며, 원산지 조회 API(List all origin)를 통해 원산지 코드 정보를 확인할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/origin
```

#### \[더보기 상세 내용\]

### Origin property list[](#origin-property-list)

| **Attribute** | **Description** |
| --- | --- |
| origin\_place\_no | 
원산지 번호

 |
| origin\_place\_name | 

원산지 이름

 |
| foreign | 

해외 여부

 |
| made\_in\_code | 

원산지 국가코드

 |

### Retrieve a list of origins [](#retrieve-a-list-of-origins)cafe24

GET /api/v2/admin/origin

###### GET

쇼핑몰에서 제공하는 원산지를 목록으로 조회할 수 있습니다.  
원산지 이름, 원산지 국가코드 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 읽기권한 (mall.read\_collection)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| origin\_place\_no | 
원산지 번호

 |
| origin\_place\_name  

_최대글자수 : \[50자\]_

 | 

원산지 이름

 |
| foreign | 

해외 여부

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

 |

Retrieve a list of origins

*   [Retrieve a list of origins](#none)
*   [Retrieve origin with fields parameter](#none)
*   [Retrieve origin using paging](#none)
*   [Retrieve a specific origin with origin\_place\_no parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Trends

트렌드(Trends)는 상품의 "제작정보" 중 트렌드에 해당하는 정보에 대한 기능입니다.  
트렌드는 상품을 구분하는 판매분류의 하나이며, 상품은 반드시 하나의 트렌드를 갖고 있습니다.(미지정시 "기본트렌드"를 사용함)

> Endpoints

```
GET /api/v2/admin/trends
GET /api/v2/admin/trends/count
```

#### \[더보기 상세 내용\]

### Trends property list[](#trends-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| trend\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

트렌드 코드

 |
| trend\_name  

_최대글자수 : \[50자\]_

 | 

트렌드 명

 |
| use\_trend | 

트렌드 사용여부

T : 사용함  
F : 사용안함

 |
| created\_date | 

생성일

 |
| product\_count | 

상품수

 |

### Retrieve a list of trends [](#retrieve-a-list-of-trends)cafe24

GET /api/v2/admin/trends

###### GET

쇼핑몰에 등록된 트렌드를 목록으로 조회할 수 있습니다.  
트렌드 코드, 트렌드 ��, 사용여부 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 읽기권한 (mall.read\_collection)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| trend\_code | 

트렌드 코드

,(콤마)로 여러 건을 검색할 수 있다.

 |
| trend\_name | 

트렌드 명

,(콤마)로 여러 건을 검색할 수 있다.

 |
| use\_trend | 

트렌드 사용여부

T : 사용함  
F : 사용안함

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

 |

Retrieve a list of trends

*   [Retrieve a list of trends](#none)
*   [Retrieve trends with fields parameter](#none)
*   [Retrieve trends using paging](#none)
*   [Retrieve a specific trends with trend\_code parameter](#none)
*   [Retrieve multiple trends](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of trends [](#retrieve-a-count-of-trends)cafe24

GET /api/v2/admin/trends/count

###### GET

쇼핑몰에 등록된 트렌드의 수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **판매분류 읽기권한 (mall.read\_collection)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| trend\_code | 

트렌드 코드

,(콤마)로 여러 건을 검색할 수 있다.

 |
| trend\_name | 

트렌드 명

,(콤마)로 여러 건을 검색할 수 있다.

 |
| use\_trend | 

트렌드 사용여부

T : 사용함  
F : 사용안함

 |

Retrieve a count of trends

*   [Retrieve a count of trends](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Supply

## Shipping suppliers

공급사 배송(Supplier Shipping)은 쇼핑몰의 각 공급사에 등록된 배송방법과 관련된 기능입니다.  
각각의 공급사에게 등록된 배송방법에 대한 정보를 조회하거나 수정할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/shipping/suppliers/{supplier_id}
PUT /api/v2/admin/shipping/suppliers/{supplier_id}
```

#### \[더보기 상세 내용\]

### Shipping suppliers property list[](#shipping-suppliers-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| supplier\_id | 

공급사 아이디

 |
| supplier\_code | 

공급사 코드

 |
| shipping\_method | 

배송방법

shipping\_01 : 택배  
shipping\_02 : 빠른등기  
shipping\_04 : 직접배송  
shipping\_05 : 퀵배송  
shipping\_06 : 기타  
shipping\_07 : 화물배송  
shipping\_08 : 매장직접수령  
shipping\_09 : 배송필요 없음

 |
| shipping\_etc  

_최대글자수 : \[25자\]_

 | 

기타배송

배송방법(shipping\_method)이 shipping\_06(기타) 일 때 기타 배송 정보

 |
| shipping\_type | 

국내/해외배송 설정

A : 국내배송  
C : 해외배송  
B : 국내/해외배송

 |
| shipping\_place  

_최대글자수 : \[127자\]_

 | 

배송지역

 |
| shipping\_start\_date  

_최소값: \[1\]_  
_최대값: \[100\]_

 | 

배송기간 시작일

 |
| shipping\_end\_date  

_최소값: \[1\]_  
_최대값: \[100\]_

 | 

배송기간 종료일

 |
| shipping\_fee\_type | 

배송비타입

T : 배송비 무료  
R : 고정배송비 사용  
M : 구매 금액에 따른 부과  
D : 구매 금액별 차등 배송료 사용  
W : 상품 무게별 차등 배송료 사용  
C : 상품 수량별 차등 배송료 사용  
N : 상품 수량에 비례하여 배송료 부과

 |
| free\_shipping\_price  

_최소값: \[0\]_  
_최대값: \[999999999\]_

 | 

배송비 무료 최소금액

배송비타입(shipping\_fee\_type)이 "M(구매 금엑에 따른 부과)" 일 때 배송비를 무료로 만들기 위한 기준 금액

 |
| shipping\_fee  

_최소값: \[0\]_  
_최대값: \[999999999\]_

 | 

배송비

배송비타입(shipping\_fee\_type)이 "R(고정배송비 사용)"이거나 "M(구매 금액에 따른 부과)"일 때 배송비 금액

 |
| shipping\_fee\_by\_quantity  

_최소값: \[0\]_  
_최대값: \[999999999\]_

 | 

상품 수량별 배송비

배송비타입(shipping\_fee\_type)이 "N(상품 수량에 비례하여 배송료 부과)"일 때 수량별 배송비 금액

 |
| shipping\_rates  

_배열 최대사이즈: \[50\]_

 | 

배송비 상세 설정

 |
| prepaid\_shipping\_fee | 

배송비 선결제 설정

C : 착불  
P : 선결제  
B : 착불/선결제

 |
| shipping\_fee\_by\_product | 

상품별 개별 배송료 설정

T : 사용함  
F : 사용안함

 |
| product\_weight  

_최소값: \[0\]_  
_최대값: \[30\]_

 | 

상품중량

 |
| hscode  

_최대글자수 : \[20자\]_

 | 

HS코드

 |
| country\_hscode  

_배열 최대사이즈: \[50\]_

 | 

국가별 HS 코드

 |

### Retrieve a supplier's shipping settings [](#retrieve-a-supplier-s-shipping-settings)cafe24 youtube

GET /api/v2/admin/shipping/suppliers/{supplier\_id}

###### GET

공급사에게 등록된 배송방법에 대한 정보를 조회할 수 있습니다.  
공급사 코드, 배송방법, 배송지역 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 읽기권한 (mall.read\_supply)** |
| 호출건수 제한 | **30** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **supplier\_id**  
**Required** | 

공급사 아이디

 |

Retrieve a supplier's shipping settings

*   [Retrieve a supplier's shipping settings](#none)
*   [Retrieve a shipping supplier with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a supplier's shipping settings [](#update-a-supplier-s-shipping-settings)cafe24 youtube

PUT /api/v2/admin/shipping/suppliers/{supplier\_id}

###### PUT

공급사에게 등록된 배송방법에 대한 정보를 수정할 수 있습니다.  
배송방법, 배송지역, 배송비타입 등을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 쓰기권한 (mall.write\_supply)** |
| 호출건수 제한 | **30** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **supplier\_id**  
**Required** | 

공급사 아이디

 |
| shipping\_method | 

배송방법

shipping\_01 : 택배  
shipping\_02 : 빠른등기  
shipping\_04 : 직접배송  
shipping\_05 : 퀵배송  
shipping\_06 : 기타  
shipping\_07 : 화물배송  
shipping\_08 : 매장직접수령  
shipping\_09 : 배송필요 없음

 |
| shipping\_etc  

_최대글자수 : \[25자\]_

 | 

기타배송

배송방법(shipping\_method)이 shipping\_06(기타) 일 때 기타 배송 정보

 |
| shipping\_type | 

국내/해외배송 설정

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

A : 국내배송  
C : 해외배송  
B : 국내/해외배송

 |
| shipping\_place  

_최대글자수 : \[127자\]_

 | 

배송지역

 |
| shipping\_start\_date  

_최소값: \[1\]_  
_최대값: \[100\]_

 | 

배송기간 시작일

 |
| shipping\_end\_date  

_최소값: \[1\]_  
_최대값: \[100\]_

 | 

배송기간 종료일

 |
| shipping\_fee\_type | 

배송비타입

T : 배송비 무료  
R : 고정배송비 사용  
M : 구매 금액에 따른 부과  
D : 구매 금액별 차등 배송료 사용  
W : 상품 무게별 차등 배송료 사용  
C : 상품 수량별 차등 배송료 사용  
N : 상품 수량에 비례하여 배송료 부과

 |
| free\_shipping\_price  

_최소값: \[0\]_  
_최대값: \[999999999\]_

 | 

배송비 무료 최소금액

배송비타입(shipping\_fee\_type)이 "M(구매 금엑에 따른 부과)" 일 때 배송비를 무료로 만들기 위한 기준 금액

 |
| shipping\_fee  

_최소값: \[0\]_  
_최대값: \[999999999\]_

 | 

배송비

배송비타입(shipping\_fee\_type)이 "R(고정배송비 사용)"이거나 "M(구매 금액에 따른 부과)"일 때 배송비 금액

 |
| shipping\_fee\_by\_quantity  

_최소값: \[0\]_  
_최대값: \[999999999\]_

 | 

상품 수량별 배송비

배송비타입(shipping\_fee\_type)이 "N(상품 수량에 비례하여 배송료 부과)"일 때 수량별 배송비 금액

 |
| shipping\_rates  

_배열 최대사이즈: \[50\]_

 | 

배송비 상세 설정

 |
| 

shipping\_rates 하위 요소 보기

**shipping\_rates\_min**  
배송비 - 배송비 부과 기준 하한값

**shipping\_rates\_max**  
배송비 - 배송비 부과 기준 상한값

**shipping\_fee**  
배송비







 |
| prepaid\_shipping\_fee | 

배송비 선결제 설정

**EC 베트남, 필리핀 버전에서는 사용할 수 없음.**

C : 착불  
P : 선결제  
B : 착불/선결제

 |
| shipping\_fee\_by\_product | 

상품별 개별 배송료 설정

T : 사용함  
F : 사용안함

 |
| product\_weight  

_최소값: \[0\]_  
_최대값: \[30\]_

 | 

상품중량

 |
| hscode  

_최대글자수 : \[20자\]_

 | 

HS코드

 |
| country\_hscode  

_배열 최대사이즈: \[24\]_

 | 

국가별 HS 코드

 |
| 

country\_hscode 하위 요소 보기

**country\_code**  
국가코드

**hscode**  
HS코드







 |

Update a supplier's shipping settings

*   [Update a supplier's shipping settings](#none)
*   [Update international shipping setting for the supplier](#none)
*   [Update shipping rates to charge according to purchase amount(free shipping if you buy above 10000)](#none)
*   [Update shipping rates to charge per purchase amount](#none)
*   [Update shipping rates to charge by product weight](#none)
*   [Update shipping rates to charge per purchase quantity](#none)
*   [Update shipping rates to charge per quantity](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Suppliers

공급사(Suppliers)는 상품의 "제작정보" 중 공급사에 입력하는 정보를 의미합니다.  
공급사는 쇼핑몰에 물품을 공급하여 상품을 팔 수 있게 하는 회사 또는 개인을 의미합니다.  
공급사는 상품을 구분하는 판매분류의 하나이며, 상품은 반드시 하나의 공급사를 갖고 있습니다.(미지정시 "자체공급"을 사용함)  
  
![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Suppliers.png)

> Endpoints

```
GET /api/v2/admin/suppliers
GET /api/v2/admin/suppliers/count
GET /api/v2/admin/suppliers/{supplier_code}
POST /api/v2/admin/suppliers
PUT /api/v2/admin/suppliers/{supplier_code}
DELETE /api/v2/admin/suppliers/{supplier_code}
```

#### \[더보기 상세 내용\]

### Suppliers property list[](#suppliers-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| supplier\_code | 

공급사 코드

시스템이 부여한 공급사의 코드. 해당 쇼핑몰 내에서 공급사 코드는 중복되지 않는다.

 |
| supplier\_name  

_최대글자수 : \[100자\]_

 | 

공급사명

공급사의 이름. 공급사명은 쇼핑몰 관리자 화면에서 공급사를 구분할 수 있는 기본적인 정보이다.

 |
| status | 

상태

해당 공급사와의 거래 현황 정보.

A : 거래중  
P : 거래중지  
N : 거래해지

 |
| commission | 

수수료

정산유형이 수수료형(P)일 경우 사용하는 수수료 정보

 |
| payment\_period | 

정산주기

공급사에 정산을 얼마나 자주할 것인지 설정할 수 있음.

0 : 선택안함  
C : 일일정산  
B : 주간정산  
A : 월간정산

 |
| business\_item  

_최대글자수 : \[255자\]_

 | 

거래상품 유형

공급사와 거래하는 상품의 유형 정보.

 |
| payment\_type | 

정산유형

공급사에 지불할 금액을 어떤 유형으로 정산할 것인지 설정할 수 있음.  
수수료형 : 상품의 판매가격에 수수료를 책정하여 수수료 금액을 반영하여 정산함  
매입형 : 상품 등록시 입력한 공급가격을 기준으로 정산함

P : 수수료형  
D : 매입형

 |
| supplier\_type | 

공급사구조

공급사의 영업 형태.  
  
도매업체 : 최종 고객에게는 판매하지 않고 소매업체에 판매하는 업체  
사입업체 : 도매업체로부터 물건을 구입해서 소매업체에 판매하는 업체  
입점업체 : 쇼핑몰에 입점하여 판매중인 업체

WS : 도매업체  
SF : 사입업체  
BS : 입점업체  
ET : 기타

 |
| use\_supplier | 

사용여부

해당 공급사를 사용하는지 여부 표시

T : 사용함  
F : 사용안함

 |
| created\_date | 

등록일

공급사 정보가 등록된 날짜

 |
| updated\_date | 

수정일

공급사 정보가 수정된 날짜

 |
| country\_code | 

사업장 주소 국가 코드

 |
| zipcode  

_최대글자수 : \[10자\]_

 | 

우편번호

공급사의 사업장 주소 우편번호.

 |
| address1  

_최대글자수 : \[255자\]_

 | 

기본 주소

공급사의 사업장 주소(시/군/구 단위 표기).

 |
| address2  

_최대글자수 : \[255자\]_

 | 

상세 주소

공급사의 사업장 주소(상세 주소 표기).

 |
| manager\_information | 

담당자

공급사의 담당자 연락처 정보. 담당자는 세명까지 지정 가능하다.

 |
| payment\_start\_day  

_최소: \[0\]~최대: \[6\]_

 | 

정산시작 요일

정산주기가 주간정산(B)일 경우 아래 요일에 따라 정산이 진행됨.  
0 : 일요일마다 정산 진행  
1 : 월요일마다 정산 진행  
2 : 화요일마다 정산 진행  
3 : 수요일마다 정산 진행  
4 : 목요일마다 정산 진행  
5 : 금요일마다 정산 진행  
6 : 토요일마다 정산 진행

0 : 일요일  
1 : 월요일  
2 : 화요일  
3 : 수요일  
4 : 목요일  
5 : 금요일  
6 : 토요일

 |
| payment\_end\_day  

_최소: \[0\]~최대: \[6\]_

 | 

정산종료 요일

정산주기가 주간정산(B)일 경우 아래 요일에 따라 정산이 진행됨.  
0 : 일요일마다 정산 진행  
1 : 월요일마다 정산 진행  
2 : 화요일마다 정산 진행  
3 : 수요일마다 정산 진행  
4 : 목요일마다 정산 진행  
5 : 금요일마다 정산 진행  
6 : 토요일마다 정산 진행

0 : 일요일  
1 : 월요일  
2 : 화요일  
3 : 수요일  
4 : 목요일  
5 : 금요일  
6 : 토요일

 |
| payment\_start\_date  

_최소: \[1\]~최대: \[31\]_

 | 

정산시작 일

정산주기가 월간정산(A)일 경우 해당 일자를 정산시작 일로 정함.

 |
| payment\_end\_date  

_최소: \[1\]~최대: \[31\]_

 | 

정산종료 일

정산주기가 월간정산(A)일 경우 해당 일자를 정산종료 일로 정함.

 |
| trading\_type | 

공급사유형

상품이 공급사에서 배송되는 형태.  
  
사입 : 상품을 판매자가 구입하여 구매자에게 배송함.  
직배송 : 상품에 주문이 들어오면 공급사가 구매자에게 바로 배송함.

D : 사입  
C : 직배송

 |
| bank\_code  

_최대글자수 : \[50자\]_

 | 

은행코드

공급사 정산시 사용하는 계좌의 입금은행 코드  
  
[bank\_code](https://d2wxkjpieznxai.cloudfront.net/resource/ko/bank_code.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| bank\_account\_no | 

계좌번호

공급사 정산시 사용하는 계좌의 계좌 번호

 |
| bank\_account\_name | 

예금주

공급사 정산시 사용하는 계좌의 예금주 명

 |
| president\_name | 

대표자명

사업자 등록시 공급사에서 등록한 대표자명

 |
| company\_registration\_no  

_최대글자수 : \[12자\]_

 | 

사업자등록번호

해당 공급사의 사업자 등록 번호. 국가에 따라 해당 사업자의 등록 고유 번호가 발급되는 경우 표시한다.

 |
| company\_name | 

상호명

사업자 등록시 공급사에서 등록한 상호명

 |
| company\_condition | 

업태

사업자 등록시 공급사에서 등록한 업태

 |
| company\_line | 

종목

사업자 등록시 공급사에서 등록한 종목

 |
| phone  

_최대글자수 : \[20자\]_

 | 

��화번호

공급사의 사업장 전화번호.

 |
| fax  

_최대글자수 : \[20자\]_

 | 

팩스번호

공급사의 사업장 팩스번호.

 |
| payment\_method | 

정산시기

정산이 되는 기준 시점.  
10 : 결제완료  
30 : 배송시작  
40 : 배송완료

10 : 결제완료  
30 : 배송시작  
40 : 배송완료

 |
| market\_country\_code | 

시장 주소 국가 코드

 |
| market\_zipcode  

_최대글자수 : \[10자\]_

 | 

시장주소 우편번호

 |
| market\_address1 | 

시장 기본 주소

 |
| market\_address2 | 

시장 상세 주소

 |
| exchange\_country\_code | 

반품 주소 국가 코드

 |
| exchange\_zipcode  

_최대글자수 : \[10자\]_

 | 

반품주소 우편번호

 |
| exchange\_address1  

_최대글자수 : \[255자\]_

 | 

반품 기본 주소

 |
| exchange\_address2  

_최대글자수 : \[255자\]_

 | 

반품 상세 주소

 |
| homepage\_url  

_최대글자수 : \[100자\]_

 | 

홈페이지 주소

 |
| mall\_url  

_최대글자수 : \[100자\]_

 | 

쇼핑몰 주소

 |
| account\_start\_date  

_최대글자수 : \[10자\]_

 | 

거래개시일

 |
| account\_stop\_date  

_최대글자수 : \[10자\]_

 | 

거래중지일

 |
| show\_supplier\_info  

_최대글자수 : \[100자\]_

 | 

공급사정보 표시

SP : 전화번호  
SM : 사업장주소  
MA : 시장주소  
EA : 반품주소  
MN : 담당자명  
MI : 담당자연락처

 |
| memo  

_최대글자수 : \[255자\]_

 | 

메모

해당 공급사에 대한 관리용 메모

 |
| company\_introduction | 

회사소개

공급사에 대한 간략한 소개 표시. 쇼핑몰의 회사 소개 화면에 표시된다.

 |

### Retrieve a list of suppliers [](#retrieve-a-list-of-suppliers)cafe24 youtube

GET /api/v2/admin/suppliers

###### GET

쇼핑몰에 등록된 공급사들을 목록으로 조회할 수 있습니다.  
공급사 코드, 공급사명, 수수료 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 읽기권한 (mall.read\_supply)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| supplier\_code | 

공급사 코드

시스템이 부여한 공급사의 코드. 해당 쇼핑몰 내에서 공급사 코드는 중복되지 않는다.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| supplier\_name | 

공급사명

공급사의 이름. 공급사명은 쇼핑몰 관리자 화면에서 공급사를 구분할 수 있는 기본적인 정보이다.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

 |

Retrieve a list of suppliers

*   [Retrieve a list of suppliers](#none)
*   [Retrieve suppliers with fields parameter](#none)
*   [Retrieve suppliers using paging](#none)
*   [Retrieve a specific suppliers with supplier\_code parameter](#none)
*   [Retrieve multiple suppliers](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of suppliers [](#retrieve-a-count-of-suppliers)cafe24 youtube

GET /api/v2/admin/suppliers/count

###### GET

쇼핑몰에 등록된 전체 공급사의 수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 읽기권한 (mall.read\_supply)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| supplier\_code | 

공급사 코드

시스템이 부여한 공급사의 코드. 해당 쇼핑몰 내에서 공급사 코드는 중복되지 않는다.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| supplier\_name | 

공급사명

공급사의 이름. 공급사명은 쇼핑몰 관리자 화면에서 공급사를 구분할 수 있는 기본적인 정보이다.

,(콤마)로 여러 건을 검색할 수 있다.

 |

Retrieve a count of suppliers

*   [Retrieve a count of suppliers](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a supplier [](#retrieve-a-supplier)cafe24 youtube

GET /api/v2/admin/suppliers/{supplier\_code}

###### GET

특정 공급사의 정보를 조회할 수 있습니다.  
공급사명, 수수료, 정산주기 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 읽기권한 (mall.read\_supply)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **supplier\_code**  
**Required** | 

공급사 코드

시스템이 부여한 공급사의 코드. 해당 쇼핑몰 내에서 공급사 코드는 중복되지 않는다.

 |

Retrieve a supplier

*   [Retrieve a supplier](#none)
*   [Retrieve a supplier with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a supplier [](#create-a-supplier)cafe24 youtube

POST /api/v2/admin/suppliers

###### POST

쇼핑몰에 공급사를 신규로 생성할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 쓰기권한 (mall.write\_supply)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **supplier\_name**  
**Required**  

_최대글자수 : \[50자\]_

 | 

공급사명

공급사의 이름. 공급사명은 쇼핑몰 관리자 화면에서 공급사를 구분할 수 있는 기본적인 정보이다.

 |
| manager\_information  

_배열 최대사이즈: \[3\]_

 | 

담당자

담당자는 최대 세명까지 입력할 수 있다.

 |
| 

manager\_information 하위 요소 보기

**no**  
**Required**  
담당자 일련번호

**name**  
**Required**  
담당자 이름

**phone**  
담당자 연락처

**email**  
담당자 이메일







 |
| use\_supplier | 

사용여부

해당 공급사를 사용하는지 여부 표시

T : 사용함  
F : 사용안함

DEFAULT T

 |
| trading\_type | 

공급사유형

상품이 공급사에서 배송되는 형태.  
  
사입 : 상품을 판매자가 구입하여 구매자에게 배송함.  
직배송 : 상품에 주문이 들어오면 공급사가 구매자에게 바로 배송함.

D : 사입  
C : 직배송

DEFAULT D

 |
| supplier\_type | 

공급사구조

공급사의 영업 형태.  
  
도매업체 : 최종 고객에게는 판매하지 않고 소매업체에 판매하는 업체  
사입업체 : 도매업체로부터 물건을 구입해서 소매업체에 판매하는 업체  
입점업체 : 쇼핑몰에 입점하여 판매중인 업체

WS : 도매업체  
SF : 사입업체  
BS : 입점업체  
ET : 기타

DEFAULT WS

 |
| status | 

상태

해당 공급사와의 거래 현황 정보.

A : 거래중  
P : 거래중지  
N : 거래해지

DEFAULT A

 |
| business\_item  

_최대글자수 : \[255자\]_

 | 

거래상품 유형

공급사와 거래하는 상품의 유형 정보.

 |
| payment\_type | 

정산유형

공급사에 지불할 금액을 어떤 유형으로 정산할 것인지 설정할 수 있음.  
수수료형 : 상품의 판매가격에 수수료를 책정하여 수수료 금액을 반영하여 정산함  
매입형 : 상품 등록시 입력한 공급가격을 기준으로 정산함

P : 수수료형  
D : 매입형

DEFAULT P

 |
| payment\_period | 

정산주기

공급사에 정산을 얼마나 자주할 것인지 설정할 수 있음.

0 : 선택안함  
C : 일일정산  
B : 주간정산  
A : 월간정산

DEFAULT 0

 |
| payment\_method | 

정산시기

정산이 되는 기준 시점.  
10 : 결제완료  
30 : 배송시작  
40 : 배송완료

10 : 결제완료  
30 : 배송시작  
40 : 배송완료

 |
| payment\_start\_day  

_최소: \[0\]~최대: \[6\]_

 | 

정산시작 요일

정산주기가 주간정산(B)일 경우 아래 요일에 따라 정산이 진행됨.  
0 : 일요일마다 정산 진행  
1 : 월요일마다 정산 진행  
2 : 화요일마다 정산 진행  
3 : 수요일마다 정산 진행  
4 : 목요일마다 정산 진행  
5 : 금요일마다 정산 진행  
6 : 토요일마다 정산 진행

0 : 일요일  
1 : 월요일  
2 : 화요일  
3 : 수요일  
4 : 목요일  
5 : 금요일  
6 : 토요일

 |
| payment\_end\_day  

_최소: \[0\]~최대: \[6\]_

 | 

정산종료 요일

정산주기가 주간정산(B)일 경우 아래 요일에 따라 정산이 진행됨.  
0 : 일요일마다 정산 진행  
1 : 월요일마다 정산 진행  
2 : 화요일마다 정산 진행  
3 : 수요일마다 정산 진행  
4 : 목요일마다 정산 진행  
5 : 금요일마다 정산 진행  
6 : 토요일마다 정산 진행

0 : 일요일  
1 : 월요일  
2 : 화요일  
3 : 수요일  
4 : 목요일  
5 : 금요일  
6 : 토요일

 |
| payment\_start\_date  

_최소: \[1\]~최대: \[31\]_

 | 

정산시작 일

정산주기가 월간정산(A)일 경우 해당 일자를 정산시작 일로 정함.

 |
| payment\_end\_date  

_최소: \[1\]~최대: \[31\]_

 | 

정산종료 일

정산주기가 월간정산(A)일 경우 해당 일자를 정산종료 일로 정함.

 |
| commission | 

수수료율

정산유형이 수수료형(P)일 경우 사용하는 수수료 정보

DEFAULT 10

 |
| phone  

_최대글자수 : \[20자\]_  
_전화번호_

 | 

전화번호

공급사의 사업장 전화번호.

 |
| fax  

_최대글자수 : \[20자\]_  
_전화번호_

 | 

팩스번호

공급사의 사업장 팩스번호.

 |
| country\_code | 

사업장 주소 국가 코드

 |
| zipcode  

_최대글자수 : \[10자\]_

 | 

우편번호

공급사의 사업장 주소 우편번호.

 |
| address1  

_최대글자수 : \[255자\]_

 | 

기본 주소

공급사의 사업장 주소(시/군/구 단위 표기).

 |
| address2  

_최대글자수 : \[255자\]_

 | 

상세 주소

공급사의 사업장 주소(상세 주소 표기).

 |
| market\_country\_code | 

시장 주소 국가 코드

 |
| market\_zipcode  

_최대글자수 : \[10자\]_

 | 

시장주소 우편번호

 |
| market\_address1 | 

시장 기본 주소

 |
| market\_address2 | 

시장 상세 주소

 |
| exchange\_country\_code | 

반품 주소 국가 코드

 |
| exchange\_zipcode  

_최대글자수 : \[10자\]_

 | 

반품주소 우편번호

 |
| exchange\_address1  

_최대글자수 : \[255자\]_

 | 

반품 기본 주소

 |
| exchange\_address2  

_최대글자수 : \[255자\]_

 | 

반품 상세 주소

 |
| homepage\_url  

_최대글자수 : \[100자\]_

 | 

홈페이지 주소

 |
| mall\_url  

_최대글자수 : \[100자\]_

 | 

쇼핑몰 주소

 |
| account\_start\_date  

_최대글자수 : \[10자\]_  
_날짜_

 | 

거래개시일

 |
| account\_stop\_date  

_최대글자수 : \[10자\]_  
_날짜_

 | 

거래중지일

 |
| memo  

_최대글자수 : \[255자\]_

 | 

메모

해당 공급사에 대한 관리용 메모

 |
| company\_registration\_no  

_최대글자수 : \[12자\]_  
_사업자번호_

 | 

사업자등록번호

해당 공급사의 사업자 등록 번호. 국가에 따라 해당 사업자의 등록 고유 번호가 발급되는 경우 표시한다.

 |
| company\_name  

_최대글자수 : \[30자\]_

 | 

상호명

사업자 등록시 공급사에서 등록한 상호명

 |
| president\_name  

_최대글자수 : \[20자\]_

 | 

대표자명

사업자 등록시 공급사에서 등록한 대표자명

 |
| company\_condition  

_최대글자수 : \[20자\]_

 | 

업태

사업자 등록시 공급사에서 등록한 업태

 |
| company\_line  

_최대글자수 : \[20자\]_

 | 

종목

사업자 등록시 공급사에서 등록한 종목

 |
| company\_introduction | 

회사소개

공급사에 대한 간략한 소개 표시. 쇼핑몰의 회사 소개 화면에 표시된다.

 |

Create a supplier

*   [Create a supplier](#none)
*   [Create a supplier using only supplier\_name field](#none)
*   [Try creating a supplier without supplier\_name field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a supplier [](#update-a-supplier)cafe24 youtube

PUT /api/v2/admin/suppliers/{supplier\_code}

###### PUT

특정 공급사의 정보를 수정할 수 있습니다.  
공급사명, 공급사유형 등을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 쓰기권한 (mall.write\_supply)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **supplier\_code**  
**Required**  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

공급사 코드

시스템이 부여한 공급사의 코드. 해당 쇼핑몰 내에서 공급사 코드는 중복되지 않는다.

 |
| supplier\_name  

_최대글자수 : \[50자\]_

 | 

공급사명

공급사의 이름. 공급사명은 쇼핑몰 관리자 화면에서 공급사를 구분할 수 있는 기본적인 정보이다.

 |
| use\_supplier | 

사용여부

해당 공급사를 사용하는지 여부 표시

T : 사용함  
F : 사용안함

 |
| trading\_type | 

공급사유형

상품이 공급사에서 배송되는 형태.  
  
사입 : 상품을 판매자가 구입하여 구매자에게 배송함.  
직배송 : 상품에 주문이 들어오면 공급사가 구매자에게 바로 배송함.

D : 사입  
C : 직배송

 |
| supplier\_type | 

공급사구조

공급사의 영업 형태.  
  
도매업체 : 최종 고객에게는 판매하지 않고 소매업체에 판매하는 업체  
사입업체 : 도매업체로부터 물건을 구입해서 소매업체에 판매하는 업체  
입점업체 : 쇼핑몰에 입점하여 판매중인 업체

WS : 도매업체  
SF : 사입업체  
BS : 입점업체  
ET : 기타

 |
| status | 

상태

해당 공급사와의 거래 현황 정보.

A : 거래중  
P : 거래중지  
N : 거래해지

 |
| payment\_type | 

정산유형

공급사에 지불할 금액을 어떤 유형으로 정산할 것인지 설정할 수 있음.  
수수료형 : 상품의 판매가격에 수수료를 책정하여 수수료 금액을 반영하여 정산함  
매입형 : 상품 등록시 입력한 공급가격을 기준으로 정산함

P : 수수료형  
D : 매입형

 |
| payment\_period | 

정산주기

공급사에 정산을 얼마나 자주할 것인지 설정할 수 있음.

0 : 선택안함  
C : 일일정산  
B : 주간정산  
A : 월간정산

 |
| commission | 

수수료율

정산유형이 수수료형(P)일 경우 사용하는 수수료 정보

 |
| manager\_information  

_배열 최대사이즈: \[3\]_

 | 

담당자

담당자는 세명까지 지정할 수 있으며, "no"를 통해 특정 담당자를 지정하여 정보를 수정할 수 있다.

 |
| 

manager\_information 하위 요소 보기

**no**  
**Required**  
담당자 일련번호

**name**  
**Required**  
담당자 이름

**phone**  
담당자 연락처

**email**  
담당자 이메일

**use\_sms**  
SMS 수신여부  
T : 수신  
F : 수신안함







 |
| business\_item  

_최대글자수 : \[255자\]_

 | 

거래상품 유형

공급사와 거래하는 상품의 유형 정보.

 |
| payment\_method | 

정산시기

정산이 되는 기준 시점.  
10 : 결제완료  
30 : 배송시작  
40 : 배송완료

10 : 결제완료  
30 : 배송시작  
40 : 배송완료

 |
| payment\_start\_day  

_최소: \[0\]~최대: \[6\]_

 | 

정산시작 요일

정산주기가 주간정산(B)일 경우 아래 요일에 따라 정산이 진행됨.  
0 : 일요일마다 정산 진행  
1 : 월요일마다 정산 진행  
2 : 화요일마다 정산 진행  
3 : 수요일마다 정산 진행  
4 : 목요일마다 정산 진행  
5 : 금요일마다 정산 진행  
6 : 토요일마다 정산 진행

0 : 일요일  
1 : 월요일  
2 : 화요일  
3 : 수요일  
4 : 목요일  
5 : 금요일  
6 : 토요일

 |
| payment\_end\_day  

_최소: \[0\]~최대: \[6\]_

 | 

정산종료 요일

정산주기가 주간정산(B)일 경우 아래 요일에 따라 정산이 진행됨.  
0 : 일요일마다 정산 진행  
1 : 월요일마다 정산 진행  
2 : 화요일마다 정산 진행  
3 : 수요일마다 정산 진행  
4 : 목요일마다 정산 진행  
5 : 금요일마다 정산 진행  
6 : 토요일마다 정산 진행

0 : 일요일  
1 : 월요일  
2 : 화요일  
3 : 수요일  
4 : 목요일  
5 : 금요일  
6 : 토���일

 |
| payment\_start\_date  

_최소: \[1\]~최대: \[31\]_

 | 

정산시작 일

정산주기가 월간정산(A)일 경우 해당 일자를 정산시작 일로 정함.

 |
| payment\_end\_date  

_최소: \[1\]~최대: \[31\]_

 | 

정산종료 일

정산주기가 월간정산(A)일 경우 해당 일자를 정산종료 일로 정함.

 |
| phone  

_최대글자수 : \[20자\]_  
_전화번호_

 | 

전화번호

공급사의 사업장 전화번호.

 |
| fax  

_최대글자수 : \[20자\]_  
_전화번호_

 | 

팩스번호

공급사의 사업장 팩스번호.

 |
| country\_code | 

사업장 주소 국가 코드

 |
| zipcode  

_최대글자수 : \[10자\]_

 | 

우편번호

공급사의 사업장 주소 우편번호.

 |
| address1  

_최대글자수 : \[255자\]_

 | 

기본 주소

공급사의 사업장 주소(시/군/구 단위 표기).

 |
| address2  

_최대글자수 : \[255자\]_

 | 

상세 주소

공급사의 사업장 주소(상세 주소 표기).

 |
| market\_country\_code | 

시장 주소 국가 코드

 |
| market\_zipcode  

_최대글자수 : \[10자\]_

 | 

시장주소 우편번호

 |
| market\_address1 | 

시장 기본 주소

 |
| market\_address2 | 

시장 상세 주소

 |
| exchange\_country\_code | 

반품 주소 국가 코드

 |
| exchange\_zipcode  

_최대글자수 : \[10자\]_

 | 

반품주소 우편번호

 |
| exchange\_address1  

_최대글자수 : \[255자\]_

 | 

반품 기본 주소

 |
| exchange\_address2  

_최대글자수 : \[255자\]_

 | 

반품 상세 주소

 |
| homepage\_url  

_최대글자수 : \[100자\]_

 | 

홈페이지 주소

 |
| mall\_url  

_최대글자수 : \[100자\]_

 | 

쇼핑몰 주소

 |
| account\_start\_date  

_최대글자수 : \[10자\]_  
_날짜_

 | 

거래개시일

 |
| account\_stop\_date  

_최대글자수 : \[10자\]_  
_날짜_

 | 

거래중지일

 |
| memo  

_최대글자수 : \[255자\]_

 | 

메모

해당 공급사에 대한 관리용 메모

 |
| company\_registration\_no  

_최대글자수 : \[12자\]_  
_사업자번호_

 | 

사업자등록번호

해당 공급사의 사업자 등록 번호. 국가에 따라 해당 사업자의 등록 고유 번호가 발급되는 경우 표시한다.

 |
| company\_name  

_최대글자수 : \[30자\]_

 | 

상호명

사업자 등록시 공급사에서 등록한 상호명

 |
| president\_name  

_최대글자수 : \[20자\]_

 | 

대표자명

사업자 등록시 공급사에서 등록한 대표자명

 |
| company\_condition  

_최대글자수 : \[20자\]_

 | 

업태

사업자 등록시 공급사에서 등록한 업태

 |
| company\_line  

_최대글자수 : \[20자\]_

 | 

종목

사업자 등록시 공급사에서 등록한 종목

 |
| company\_introduction | 

회사소개

공급사에 대한 간략한 소개 표시. 쇼핑몰의 회사 소개 화면에 표시된다.

 |

Update a supplier

*   [Update a supplier](#none)
*   [Update the supplier name](#none)
*   [Disable the supplier](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a supplier [](#delete-a-supplier)cafe24 youtube

DELETE /api/v2/admin/suppliers/{supplier\_code}

###### DELETE

쇼핑몰에 생성된 공급사를 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 쓰기권한 (mall.write\_supply)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **supplier\_code**  
**Required**  
_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

공급사 코드

 |

Delete a supplier

*   [Delete a supplier](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Suppliers users

공급사 운영자(Supplier Users)는 공급사가 쇼핑몰에 로그인하여 상품을 직접 등록해야할 경우 필요합니다.  
공급사 운영자에게 상품 업로드, 분류 관리, 게시판 관리 등 제한적인 권한을 부여할 수 있습니다.  
  
![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Suppliers%20users.png)

> Endpoints

```
GET /api/v2/admin/suppliers/users
GET /api/v2/admin/suppliers/users/count
GET /api/v2/admin/suppliers/users/{user_id}
POST /api/v2/admin/suppliers/users
PUT /api/v2/admin/suppliers/users/{user_id}
DELETE /api/v2/admin/suppliers/users/{user_id}
```

#### \[더보기 상세 내용\]

### Suppliers users property list[](#suppliers-users-property-list)

| **Attribute** | **Description** |
| --- | --- |
| user\_id  
_형식 : \[a-z0-9\]_  
_글자수 최소: \[4자\]~최대: \[16자\]_

 | 

공급사 운영자 아이디

공급사 운영자가 로그인할 경우 사용하는 로그인 아이디. 부운영자와 마찬가지로 쇼핑몰 관리자 화면에 로그인하면 공급사 관리자 화면에 접근할 수 있다.

 |
| supplier\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

공급사 코드

시스템에서 부여한 공급사의 코드. 해당 쇼핑몰 내에서 공급사 코드는 중복되지 않는다.

 |
| supplier\_name  

_최대글자수 : \[100자\]_

 | 

공급사명

공급사의 이름. 공급사명은 쇼핑몰 관리자 화면에서 공급사를 구분할 수 있는 기본적인 정보이다.

 |
| permission\_category\_select | 

상품 등록 시 분류선택 권한

공급사 운영자가 상품 등록시 상품 분류를 선택하여 등록할 수 있는지에 대한 권한 설정

 |
| permission\_product\_modify | 

상품 수정 권한

공급사 운영자가 상품을 등록한 후 상품 정보를 수정할 수 있는 권한 설정

 |
| permission\_product\_display | 

상품 진열 권한

공급사 운영자가 상품을 등록한 후 쇼핑몰 화면에 진열할 수 있는 권한 설정

 |
| permission\_product\_selling | 

상품 판매 권한

공급사 운영자가 상품을 등록한 후 해당 상품의 판매여부를 설정할 수 있는 권한 설정

 |
| permission\_product\_delete | 

등록 상품 삭제 권한

공급사 운영자가 자신이 등록한 상품을 삭제할 수 있는 권한 설정

 |
| permission\_amount\_inquiry | 

주문 금액 조회 권한

 |
| permission\_board\_manage | 

게시판 권한 설정

공급사 운영자가 쇼핑몰의 게시판에 접근할 수 있는 권한 설정

T : 허용함  
F : 허용안함

 |
| permission\_order\_menu | 

주문 메뉴 접근 권한

 |
| permission\_order\_cs | 

취소/교환/반품/환불 처리 권한

 |
| permission\_order\_refund | 

환불 완료 처리

 |
| user\_name | 

공급사운영자명

공급사 운영자의 이름. 공급사 운영자 명은 공급사 운영자가 쇼핑몰 관리자 화면에서 어떤 작업을 할 경우 "작업을 실행한 사람(처리자)" 부분에 표시되는 이름을 의미한다.  
공급사 운영자 상세 조회 API에서만 확인 가능하다.

 |
| nick\_name | 

별명

공급사 운영자의 별명. 공급사 운영자 별명은 공급사 운영자가 게시판에 게시글 작성할 경우 "게시자" 부분에 표시되는 별명을 의미한다.(단, 해당 게시판이 작성자명 대신 '별명'을 노출하도록 설정되어있을 경우에 한 함)  
공급사 운영자 상세 조회 API에서만 확인 가능하다.

 |
| nick\_name\_icon\_type | 

별명 아이콘 타입

공급사 운영자의 별명 옆에 표시되는 아이콘을 설정할 수 있다.  
  
직접 아이콘 등록 : 별명 아이콘을 직접 업로드하여 설정할 수 있다.  
샘플 아이콘 등록 : 미리 제공되는 아이콘을 선택하여 설정할 수 있다.  
공급사 운영자 상세 조회 API에서만 확인 가능하다.

D : 직접  
S : 샘플

 |
| nick\_name\_icon\_url  

_최대글자수 : \[255자\]_

 | 

별명 아이콘 URL

공급사 운영자의 별명 아이콘의 이미지 경로.  
  
공급사 운영자 상세 조회 API에서만 확인 가능하다.

 |
| use\_nick\_name\_icon | 

게시판 닉네임 아이콘 노출 설정

공급사 운영자가 게시판에 게시글 작성시 별명 아이콘을 노출할 것인지 여부 표시  
  
공급사 운영자 상세 조회 API에서만 확인 가능하다.

 |
| use\_writer\_name\_icon | 

게시판 작성자 노출 설정

공급사 운영자가 게시판에 게시글 작성시 작성자 명을 노출할 것인지 여부 표시  
  
공급사 운영자 상세 조회 API에서만 확인 가능하다.

 |
| email  

_이메일_

 | 

이메일

공급사 운영자의 이메일 주소. 공급사 운영자의 연락처 저장 목적으로 사용함.  
  
공급사 운영자 상세 조회 API에서만 확인 가능하다.

 |
| phone | 

전화번호

공급사 운영자의 전화번호. 공급사 운영자의 연락처 저�� 목적으로 사용함.  
  
공급사 운영자 상세 조회 API에서만 확인 가능하다.

 |
| permission\_shop\_no | 

접근가능 쇼핑몰

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| permitted\_category\_list | 

상품 등록시 허용 상품분류

공급사 운영자가 상품 등록시 선택 가능한 상품 분류. 공급사 운영자는 상품 등록시 해당 상품 분류에만 상품을 올릴 수 있다.  
  
공급사 운영자 상세 조회 API에서만 확인 가능하다.

 |
| permission\_delivery\_fee\_inquiry | 

배송비 조회 권한

 |

### Retrieve a list of supplier users [](#retrieve-a-list-of-supplier-users)cafe24 youtube

GET /api/v2/admin/suppliers/users

###### GET

쇼핑몰에 등록된 공급사 운영자를 목록으로 조회할 수 있습니다.  
공급사 코드, 공급사명, 공급사운영자명 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 읽기권한 (mall.read\_supply)** |
| 호출건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| user\_id  

_형식 : \[a-zA-Z0-9\]_  
_글자수 최소: \[4자\]~최대: \[16자\]_

 | 

공급사 운영자 아이디

공급사 운영자가 로그인할 경우 사용하는 로그인 아이디. 부운영자와 마찬가지로 쇼핑몰 관리자 화면에 로그인하면 공급사 관리자 화면에 접근할 수 있다.

 |
| supplier\_code  

_최대글자수 : \[8자\]_

 | 

공급사 코드

시스템에서 부여한 공급사의 코드. 해당 쇼핑몰 내에서 공급사 코드는 중복되지 않는다.

 |
| supplier\_name  

_최대글자수 : \[100자\]_

 | 

공급사명

공급사의 이름. 공급사명은 쇼핑몰 관리자 화면에서 공급사를 구분할 수 있는 기본적인 정보이다.

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

 |

Retrieve a list of supplier users

*   [Retrieve a list of supplier users](#none)
*   [Retrieve users with fields parameter](#none)
*   [Retrieve a specific users with supplier\_code parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of supplier users [](#retrieve-a-count-of-supplier-users)cafe24 youtube

GET /api/v2/admin/suppliers/users/count

###### GET

쇼핑몰에 등록된 공급사 운영자의 수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 읽기권한 (mall.read\_supply)** |
| 호출건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| user\_id  

_형식 : \[a-zA-Z0-9\]_  
_글자수 최소: \[4자\]~최대: \[16자\]_

 | 

공급사 운영자 아이디

공급사 운영자가 로그인할 경우 사용하는 로그인 아이디. 부운영자와 마찬가지로 쇼핑몰 관리자 화면에 로그인하면 공급사 관리자 화면에 접근할 수 있다.

 |
| supplier\_code  

_최대글자수 : \[8자\]_

 | 

공급사 코드

시스템에서 부여한 공급사의 코드. 해당 쇼핑몰 내에서 공급사 코드는 중복되지 않는다.

 |
| supplier\_name  

_최대글자수 : \[100자\]_

 | 

공급사명

공급사의 이름. 공급사명은 쇼핑몰 관리자 화면에서 공급사를 구분할 수 있는 기본적인 정보이다.

 |

Retrieve a count of supplier users

*   [Retrieve a count of supplier users](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve supplier user details [](#retrieve-supplier-user-details)cafe24 youtube

GET /api/v2/admin/suppliers/users/{user\_id}

###### GET

쇼핑몰에 등록된 특정 공급사 운영자를 조회할 수 있습니다.  
공급사명, 공급사의 권한, 별명 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 읽기권한 (mall.read\_supply)** |
| 호출건수 제한 | **10** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| user\_id  

_형식 : \[a-zA-Z0-9\]_  
_글자수 최소: \[4자\]~최대: \[16자\]_

 | 

공급사 운영자 아이디

공급사 운영자가 로그인할 경우 사용하는 로그인 아이디. 부운영자와 마찬가지로 쇼핑몰 관리자 화면에 로그인하면 공급사 관리자 화면에 접근할 수 있다.

 |

Retrieve supplier user details

*   [Retrieve supplier user details](#none)
*   [Retrieve a supplier user with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a supplier user [](#create-a-supplier-user)cafe24 youtube

POST /api/v2/admin/suppliers/users

###### POST

쇼핑몰에 공급사 운영자를 새로이 등록할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 쓰기권한 (mall.write\_supply)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **user\_id**  
**Required**  
_형식 : \[a-z0-9\]_  
_글자수 최소: \[4자\]~최대: \[16자\]_

 | 

공급사 운영자 아이디

 |
| **supplier\_code**  
**Required**  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

공급사 코드

 |
| user\_name | 

공급사운영자명

필수 입력 필요

 |
| 

user\_name 하위 요소 보기

**shop\_no**  
**Required**  
멀티쇼핑몰 번호

**user\_name**  
**Required**  
공급사운영자명







 |
| nick\_name | 

별명

 |
| 

nick\_name 하위 요소 보기

**shop\_no**  
멀티쇼핑몰 번호

**nick\_name**  
별명







 |
| **password**  
**Required** | 

접속 비밀번호

 |
| use\_nick\_name\_icon | 

게시판 닉네임 아이콘 노출 설정

T : 사용함  
F : 사용안함

DEFAULT F

 |
| use\_writer\_name\_icon | 

게시판 작성자 노출 설정

T : 사용함  
F : 사용안함

DEFAULT F

 |
| email  

_이메일_

 | 

이메일

 |
| phone | 

전화번호

 |
| **permission\_shop\_no**  
**Required** | 

접근가능 쇼핑몰

 |
| permission\_category\_select | 

상품 등록 시 분류선택 권한

T : 사용함  
F : 사용안함

DEFAULT T

 |
| permitted\_category\_list | 

상품 등록시 허용 상품분류

 |
| permission\_product\_modify | 

상품 수정 권한

T : 사용함  
F : 사용안함

DEFAULT T

 |
| permission\_product\_display | 

상품 진열 권한

T : 사용함  
F : 사용안함

DEFAULT T

 |
| permission\_product\_selling | 

상품 판매 권한

T : 사용함  
F : 사용안함

DEFAULT T

 |
| permission\_product\_delete | 

등록 상품 삭제 권한

T : 사용함  
F : 사용안함

DEFAULT T

 |
| permission\_order\_menu | 

주문 메뉴 접근 권한

T : 사용함  
F : 사용안함

DEFAULT T

 |
| permission\_amount\_inquiry | 

주문 금액 조회 권한

T : 사용함  
F : 사용안함

DEFAULT F

 |
| permission\_order\_cs | 

취소/교환/반품/환불 처리 권한

T : 사용함  
F : 사용안함

DEFAULT F

 |
| permission\_order\_refund | 

환불 완료 처리

T : 사용함  
F : 사용안함

DEFAULT F

 |
| permission\_delivery\_fee\_inquiry | 

배송비 조회 권한

T : 사용함  
F : 사용안함

DEFAULT F

 |

Create a supplier user

*   [Create a supplier user](#none)
*   [Create a supplier user by using only required fields](#none)
*   [Try creating a supplier user wihtout using user\_id field](#none)
*   [Try creating a supplier user wihtout using supplier\_code field](#none)
*   [Try creating a supplier user wihtout using user\_name field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a supplier user [](#update-a-supplier-user)cafe24 youtube

PUT /api/v2/admin/suppliers/users/{user\_id}

###### PUT

쇼핑몰에 등록된 특정 공급사 운영자의 정보를 수정할 수 있습니다.  
공급사운영자명, 별명, 비밀번호 등을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 쓰기권한 (mall.write\_supply)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **user\_id**  
**Required**  
_형식 : \[a-z0-9\]_  
_글자수 최소: \[4자\]~최대: \[16자\]_

 | 

공급사 운영자 아이디

 |
| user\_name | 

공급사운영자명

필수 입력 필요

 |
| 

user\_name 하위 요소 보기

**shop\_no**  
멀티쇼핑몰 번호

**user\_name**  
공급사운영자명







 |
| nick\_name | 

별명

 |
| 

nick\_name 하위 요소 보기

**shop\_no**  
멀티쇼핑몰 번호

**nick\_name**  
별명







 |
| password | 

접속 비밀번호

 |
| use\_nick\_name\_icon | 

게시판 닉네임 아이콘 노출 설정

T : 사용함  
F : 사용안함

 |
| use\_writer\_name\_icon | 

게시판 작성자 노출 설정

T : 사용함  
F : 사용안함

 |
| email  

_이메일_

 | 

이메일

 |
| phone | 

전화번호

 |
| permission\_shop\_no | 

접근가능 쇼핑몰

 |
| permission\_category\_select | 

상품 등록 시 분류선택 권한

T : 사용함  
F : 사용안함

 |
| permitted\_category\_list | 

상품 등록시 허용 상품분류

 |
| permission\_product\_modify | 

상품 수정 권한

T : 사용함  
F : 사용안함

 |
| permission\_product\_display | 

상품 진열 권한

T : 사용함  
F : 사용안함

 |
| permission\_product\_selling | 

상품 판매 권한

T : 사용함  
F : 사용안함

 |
| permission\_product\_delete | 

등록 상품 삭제 권한

T : 사용함  
F : 사용안함

 |
| permission\_order\_menu | 

주문 메뉴 접근 권한

T : 사용함  
F : 사용안함

 |
| permission\_amount\_inquiry | 

주문 금액 조회 권한

T : 사용함  
F : 사용안함

 |
| permission\_order\_cs | 

취소/교환/반품/환불 처리 권한

T : 사용함  
F : 사용안함

 |
| permission\_order\_refund | 

환불 완료 처리

T : 사용함  
F : 사용안함

 |
| permission\_delivery\_fee\_inquiry | 

배송비 조회 권한

T : 사용함  
F : 사용안함

DEFAULT F

 |

Update a supplier user

*   [Update a supplier user](#none)
*   [Update supplier's name, email, phone number](#none)
*   [Update supplier's permission](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a supplier user [](#delete-a-supplier-user)cafe24 youtube

DELETE /api/v2/admin/suppliers/users/{user\_id}

###### DELETE

쇼핑몰에 등록된 특정 공급사 운영자를 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 쓰기권한 (mall.write\_supply)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **user\_id**  
**Required**  
_형식 : \[a-z0-9\]_  
_글자수 최소: \[4자\]~최대: \[16자\]_

 | 

공급사 운영자 아이디

 |

Delete a supplier user

*   [Delete a supplier user](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Suppliers users regionalsurcharges

공급사 지역별 배송비(Suppliers users regionalsurcharges)를 통해 공급사별로 지역별 배송비를 설정하거나, 설정된 정보를 조회할 수 있습니다.  
  
![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Suppliers%20users%20regionalsurcharges.png)

> Endpoints

```
GET /api/v2/admin/suppliers/users/{supplier_id}/regionalsurcharges
POST /api/v2/admin/suppliers/users/{supplier_id}/regionalsurcharges
DELETE /api/v2/admin/suppliers/users/{supplier_id}/regionalsurcharges/{regional_surcharge_no}
```

#### \[더보기 상세 내용\]

### Suppliers users regionalsurcharges property list[](#suppliers-users__regionalsurcharges-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| regional\_surcharge\_no | 

지역별 배송비 등록 번호

 |
| supplier\_id  

_최대글자수 : \[20자\]_

 | 

공급사 아이디

 |
| country\_code  

_최대글자수 : \[2자\]_

 | 

국가코드

KR : 대한민국  
JP : 일본  
VN : 베트남

 |
| region\_name  

_최대글자수 : \[255자\]_

 | 

특수지역명

 |
| surcharge\_region\_name  

_최대글자수 : \[300자\]_

 | 

지역명

추가배송비를 부과할 지역이름  
지역 설정방��(region\_setting\_type)이 'N'으로 설정 되어있는 경우 필수 입력

 |
| start\_zipcode  

_최대글자수 : \[8자\]_

 | 

시작 우편번호

지역 설정 방식(region\_setting\_type)이 'Z'로 설정 되어있는 경우 필수 입력

 |
| end\_zipcode  

_최대글자수 : \[8자\]_

 | 

끝 우편번호

지역 설정 방식(region\_setting\_type)이 'Z'로 설정 되어있는 경우 필수 입력

 |
| regional\_surcharge\_amount  

_최소: \[1\]~최대: \[999999999\]_

 | 

지역 추가 배송비

부과할 추가배송비 금액

 |
| use\_regional\_surcharge | 

지역별 배송비 사용여부

T : 사용함  
F : 사용안함

 |

### Retrieve a supplier user's list of regional shipping fees [](#retrieve-a-supplier-user-s-list-of-regional-shipping-fees)cafe24 youtube

GET /api/v2/admin/suppliers/users/{supplier\_id}/regionalsurcharges

###### GET

특정 공급사의 등록된 지역별 배송비 설정을 목록으로 조회할 수 있습니다.  
국가코드, 지역명, 지역 추가 배송비 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 읽기권한 (mall.read\_supply)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **supplier\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

공급사 아이디

 |
| offset  

_최대값: \[10000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve a supplier user's list of regional shipping fees

*   [Retrieve a supplier user's list of regional shipping fees](#none)
*   [Retrieve regionalsurcharges with fields parameter](#none)
*   [Retrieve regionalsurcharges using paging](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create regional shipping fee for a supplier user [](#create-regional-shipping-fee-for-a-supplier-user)cafe24 youtube

POST /api/v2/admin/suppliers/users/{supplier\_id}/regionalsurcharges

###### POST

특정 공급사의 지역별 배송비 설정을 등록할 수 있습니다.  
공급사 하나당 지역별로 여러 배송비를 등록할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 쓰기권한 (mall.write\_supply)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **supplier\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

공급사 아이디

 |
| country\_code  

_최대글자수 : \[2자\]_

 | 

국가코드

**EC 한국, 일본, 베트남, 필리핀 버전에서는 사용할 수 없음.**

KR : 대한민국  
JP : 일본  
VN : 베트남

 |
| **region\_name**  
**Required**  

_최대글자수 : \[255자\]_

 | 

특수지역명

 |
| **use\_regional\_surcharge**  
**Required** | 

지역별 배송비 사용여부

T : 사용함  
F : 사용안함

 |
| surcharge\_region\_name  

_최대글자수 : \[300자\]_

 | 

지역명

 |
| start\_zipcode  

_최대글자수 : \[8자\]_

 | 

시작 우편번호

 |
| end\_zipcode  

_최대글자수 : \[8자\]_

 | 

끝 우편번호

 |
| **regional\_surcharge\_amount**  
**Required**  

_최소: \[1\]~최대: \[999999999\]_

 | 

지역 추가 배송비

 |

Create regional shipping fee for a supplier user

*   [Create regional shipping fee for a supplier user](#none)
*   [Create a setting for suppliers users regionalsurcharge with region\_setting\_type field valuse is 'z'](#none)
*   [Try creating a setting for suppliers users regionalsurcharge by without region\_name field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete supplier user's regional shipping fee settings [](#delete-supplier-user-s-regional-shipping-fee-settings)cafe24 youtube

DELETE /api/v2/admin/suppliers/users/{supplier\_id}/regionalsurcharges/{regional\_surcharge\_no}

###### DELETE

특정 공급사의 등록된 지역별 배송비 설정을 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 쓰기권한 (mall.write\_supply)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **supplier\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

공급사 아이디

 |
| **regional\_surcharge\_no**  
**Required** | 

지역별 배송비 등록 번호

 |

Delete supplier user's regional shipping fee settings

*   [Delete supplier user's regional shipping fee settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Suppliers users regionalsurcharges setting

공급사 지역별 배송비 설정(Suppliers users regionalsurcharges setting)을 통해 공급사별로 지역별 배송비를 설정값을 조회하거나 수정할 수 있습니다.  
  
![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Suppliers%20users%20regionalsurcharges%20setting.png)

> Endpoints

```
GET /api/v2/admin/suppliers/users/{supplier_id}/regionalsurcharges/setting
PUT /api/v2/admin/suppliers/users/{supplier_id}/regionalsurcharges/setting
```

#### \[더보기 상세 내용\]

### Suppliers users regionalsurcharges setting property list[](#suppliers-users__regionalsurcharges-setting-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| supplier\_id  

_최대글자수 : \[20자\]_

 | 

공급사 아이디

 |
| use\_regional\_surcharge | 

지역별 배송비 사용여부

T : 사용함  
F : 사용안함

 |
| region\_setting\_type | 

지역 설정 방식

A : 간편 설정  
N : 지명 설정  
Z : 우편번호 설정

 |
| jeju\_surcharge\_amount  

_최소: \[0\]~최대: \[999999999\]_

 | 

제주 추가 배송비

 |
| remote\_area\_surcharge\_amount  

_최소: \[0\]~최대: \[999999999\]_

 | 

도서산간 추가 배송비

 |

### Retrieve a supplier user's regional shipping fee settings [](#retrieve-a-supplier-user-s-regional-shipping-fee-settings)cafe24 youtube

GET /api/v2/admin/suppliers/users/{supplier\_id}/regionalsurcharges/setting

###### GET

특정 공급사의 지역별 배송비 설정을 조회할 수 있습니다.  
지역별 배송비 사용 여부와 지역 설정 방식을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 읽기권한 (mall.read\_supply)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **supplier\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

공급사 아이디

 |

Retrieve a supplier user's regional shipping fee settings

*   [Retrieve a supplier user's regional shipping fee settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a supplier user's regional shipping fee settings [](#update-a-supplier-user-s-regional-shipping-fee-settings)cafe24 youtube

PUT /api/v2/admin/suppliers/users/{supplier\_id}/regionalsurcharges/setting

###### PUT

특정 공급사의 지역별 배송비 설정을 수정할 수 있습니다.  
지역별 배송비 사용 여부와 지역 설정 방식을 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **공급사 정보 쓰기권한 (mall.write\_supply)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **supplier\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

공급사 아이디

 |
| **use\_regional\_surcharge**  
**Required** | 

지역별 배송비 사용여부

T : 사용함  
F : 사용안함

 |
| **region\_setting\_type**  
**Required** | 

지역 설정 방식

A : 간편 설정  
N : 지명 설정  
Z : 우편번호 설정

 |
| jeju\_surcharge\_amount  

_최소: \[0\]~최대: \[999999999\]_

 | 

제주 추가 배송비

 |
| remote\_area\_surcharge\_amount  

_최소: \[0\]~최대: \[999999999\]_

 | 

도서산간 추가 배송비

 |

Update a supplier user's regional shipping fee settings

*   [Update a supplier user's regional shipping fee settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Shipping

## Carriers

배송사(Carriers)는 쇼핑몰로부터 쇼핑몰 고객에게까지 상품을 배송하는 주체입니다.  
배송사를 등록하면 쇼핑몰에서 배송처리시 해당 배송사를 선택하여 배송 처리를 진행할 수 있습니다.  
배송사 리소스에서는 현재 등록되어있는 배송사를 조회하고 배송사를 생성, 수정, 삭제처리할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/carriers
GET /api/v2/admin/carriers/{carrier_id}
POST /api/v2/admin/carriers
PUT /api/v2/admin/carriers/{carrier_id}
DELETE /api/v2/admin/carriers/{carrier_id}
```

#### \[더보기 상세 내용\]

### Carriers property list[](#carriers-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| carrier\_id | 

배송사 아이디

 |
| shipping\_carrier\_code | 

배송사 코드

[shipping\_company\_code](https://s3.ap-northeast-2.amazonaws.com/appservice-guide/resource/ko/shipping_company_code_kr.csv) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| shipping\_carrier | 

배송사 명

 |
| track\_shipment\_url | 

배송추적 URL

 |
| shipping\_type | 

국내/해외배송 설정

A : 국내  
B : 국내/해외  
C : 해외  
F : 설정안함

 |
| contact | 

대표 연락처

 |
| secondary\_contact | 

보조 연락처

 |
| email | 

이메일

 |
| default\_shipping\_fee | 

기본 배송비

 |
| homepage\_url | 

홈페이지 주소

 |
| default\_shipping\_carrier | 

기본배송사 여부

T : 사용함  
F : 사용안함

 |
| shipping\_fee\_setting | 

배송비 설정 여부

T : 사용함  
F : 사용안함

 |
| shipping\_fee\_setting\_detail | 

배송비 설정 데이터

 |
| express\_exception\_setting | 

연동택배 예외정보 설정

 |
| links | 

link

 |

### Retrieve a list of shipping carriers [](#retrieve-a-list-of-shipping-carriers)cafe24 youtube

GET /api/v2/admin/carriers

###### GET

생성된 배송사를 목록으로 조회할 수 있습니다.  
배송사명, 배송사 코드, 배송비 설정 데이터 등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 읽기권한 (mall.read\_shipping)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve a list of shipping carriers

*   [Retrieve a list of shipping carriers](#none)
*   [Retrieve carriers with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a shipping carrier [](#retrieve-a-shipping-carrier)cafe24 youtube

GET /api/v2/admin/carriers/{carrier\_id}

###### GET

특정 배송사 하나를 선택하여 상세조회할 수 있습니다.  
배송사명, 배송사 코드, 배송비 설정 데이터 등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 읽기권한 (mall.read\_shipping)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **carrier\_id**  
**Required** | 

배송업체 아이디

 |

Retrieve a shipping carrier

*   [Retrieve a shipping carrier](#none)
*   [Retrieve a carrier with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a shipping carrier [](#create-a-shipping-carrier)cafe24 youtube

POST /api/v2/admin/carriers

###### POST

배송사를 생성할 수 있습니다.  
배송사를 생성하면서 배송사별로 배송비 설정도 진행할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 쓰기권한 (mall.write\_shipping)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **shipping\_carrier\_code**  
**Required** | 

배송사 코드

[shipping\_company\_code](https://s3.ap-northeast-2.amazonaws.com/appservice-guide/resource/ko/shipping_company_code_kr.csv) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| **contact**  
**Required**  

_최대글자수 : \[16자\]_

 | 

대표 연락처

 |
| **email**  
**Required**  

_이메일_  
_최대글자수 : \[255자\]_

 | 

이메일

 |
| shipping\_carrier  

_최대글자수 : \[80자\]_

 | 

배송사 명

 |
| track\_shipment\_url  

_최대글자수 : \[255자\]_

 | 

배송추적 URL

 |
| secondary\_contact  

_최대글자수 : \[16자\]_

 | 

보조 연락처

**Youtube shopping 이용 시에는 미제공**

 |
| default\_shipping\_fee | 

기본 배송비

 |
| homepage\_url  

_최대글자수 : \[255자\]_

 | 

홈페이지 주소

**Youtube shopping 이용 시에는 미제공**

 |
| shipping\_fee\_setting | 

배송비 설정 여부

T : 사용함  
F : 사용안함

DEFAULT F

 |
| shipping\_fee\_setting\_detail | 

배송비 설정 데이터

※shipping\_fee\_setting\_detail의 하위요소에 대한 값 정의  
  
1)shipping\_fee\_setting\_domestic > shipping\_fee\_type  
  
shipping\_fee\_type(배송비 설정)  
T : 배송비 무료  
R : 고정배송비 사용  
M : 구매 금액에 따른 부과  
D : 구매 금액별 차등 배송료 사용  
W : 상품 무게별 차등 배송료 사용  
C : 상품 수량별 차등 배송료 사용  
N : 상품 수량에 비례하여 배송료 부과  
  
2)shipping\_fee\_setting\_domestic > shipping\_fee\_criteria  
  
shipping\_fee\_criteria(배송비 청구 기준 주문금액 조건 설정)  
D : 할인전, 정상판매가격 기준(권장)  
A : 할인 적용 후 결제 금액 기준  
  
3)shipping\_fee\_setting\_oversea > additional\_handling\_fee\_list > unit  
  
unit(해외배송 부가금액 단위)  
W : 정액  
P : 퍼센트  
  
4)shipping\_fee\_setting\_oversea > additional\_handling\_fee\_list > rounding\_unit  
  
rounding\_unit(해외배송 부가금액 절사단위)  
F : 절사안함  
0 : 1단위  
1 : 10단위  
2 : 100단위  
3 : 1000단위  
  
5)shipping\_fee\_setting\_oversea > additional\_handling\_fee\_list > rounding\_rule  
  
rounding\_rule(해외배송 부가금액 절사방식)  
L : 내림  
U : 반올림  
C : 올림

 |
| 

shipping\_fee\_setting\_detail 하위 요소 보기

**shipping\_type**  
국내/해외배송 설정  
A : 국내  
B : 국내/해외  
C : 해외  
DEFAULT B

**available\_shipping\_zone**  
배송가능 지역

**min\_shipping\_period**  
배송가능 최소일

**max\_shipping\_period**  
배송가능 최대일

**shipping\_information**  
주문서 배송안내

**shipping\_fee\_setting\_domestic** _Array_

shipping\_fee\_setting\_domestic 하위 요소 보기

**shipping\_fee\_type**  
배송비 설정

**shipping\_fee**  
배송비

**min\_price**  
미만 조건금액

**use\_product\_category**  
선택 상품분류 적용

**product\_category\_list** _Array_  

product\_category\_list 하위 요소 보기

**category\_no**  
카테고리 번호

**shipping\_fee\_criteria**  
배송비 청구 기준 주문금액 조건 설정

**domestic\_shipping\_fee\_list** _Array_  

domestic\_shipping\_fee\_list 하위 요소 보기

**min\_value**  
구간 금액 min

**max\_value**  
구간 금액 max

**shipping\_fee**  
배송비

**available\_shipping\_zone**  
배송가능 지역 설정 여부

**available\_shipping\_zone\_list** _Array_  

available\_shipping\_zone\_list 하위 요소 보기

**region**  
배송가능지역 명

**start\_zipcode**  
시작 우편번호

**end\_zipcode**  
끝 우편번호

**available\_order\_time**  
주문가능 시간 설정

**start\_time**  
주문가능 시작 시간

**end\_time**  
주문가능 마감 시간

**shipping\_fee\_setting\_oversea** _Array_

shipping\_fee\_setting\_oversea 하위 요소 보기

**shipping\_fee\_criteria**  
배송비 청구 기준 주문금액 조건 설정

**shipping\_country\_list** _Array_  

shipping\_country\_list 하위 요소 보기

**country\_code**  
국가코드

**country\_shipping\_fee\_list** _Array_  

country\_shipping\_fee\_list 하위 요소 보기

**country\_code**  
국가코드

**conditional**  
구간 조건

**min\_value**  
구간 금액 min

**max\_value**  
구간 금액 max

**shipping\_fee**  
배송비

**additional\_handling\_fee**  
해외배송 부가금액 여부

**additional\_handling\_fee\_list** _Array_  

additional\_handling\_fee\_list 하위 요소 보기

**country\_code**  
국가코드

**text**  
부과금액 명칭

**min\_value**  
구간 금액 min

**max\_value**  
구간 금액 max

**additional\_handling\_fee**  
해외배송 부가금액

**unit**  
해외배송 부가금액 단위

**rounding\_unit**  
절사단위

**rounding\_rule**  
절사 방법

**maximum\_quantity**  
총 구매수량 제한

**product\_category\_limit**  
상품분류 제한 여부

**product\_category\_limit\_list** _Array_  

product\_category\_limit\_list 하위 요소 보기

**category\_no**  
카테고리 번호

**product\_maximum\_quantity**  
상품분류별 구매수량 제한



















 |

Create a shipping carrier

*   [Create a shipping carrier](#none)
*   [Create a carrier that using fixed rate](#none)
*   [Create a carrier that using detailed shipping fee setting](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a shipping carrier [](#update-a-shipping-carrier)cafe24 youtube

PUT /api/v2/admin/carriers/{carrier\_id}

###### PUT

특정 배송사를 수정할 수 있습니다.  
기본배송사 여부 설정값을 변경할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 쓰기권한 (mall.write\_shipping)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **carrier\_id**  
**Required** | 

배송사 아이디

 |
| default\_shipping\_carrier | 

기본배송사 여부

T : 사용함  
F : 사용안함

DEFAULT T

 |

Update a shipping carrier

*   [Update a shipping carrier](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a shipping carrier [](#delete-a-shipping-carrier)cafe24 youtube

DELETE /api/v2/admin/carriers/{carrier\_id}

###### DELETE

특정 배송사를 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 쓰기권한 (mall.write\_shipping)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **carrier\_id**  
**Required** | 

배송사 아이디

 |
| delete\_default\_carrier | 

기본배송사 삭제 여부

T : 삭제함  
F : 삭제안함

DEFAULT F

 |

Delete a shipping carrier

*   [Delete a shipping carrier](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Regionalsurcharges

지역별 배송비(Suppliers users regionalsurcharges)를 통해 지역별 배송비를 설정하거나, 설정된 정보를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/regionalsurcharges
PUT /api/v2/admin/regionalsurcharges
```

#### \[더보기 상세 내용\]

### Regionalsurcharges property list[](#regionalsurcharges-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| use\_regional\_surcharge | 

지역별 배송비 사용여부

T : 사용함  
F : 사용안함

 |
| region\_setting\_type | 

지역 설정 방식

A : 간편 설정  
N : 지명 설정  
Z : 우편번호 설정

 |
| regional\_surcharge\_list | 

지역별 배송비 목록

 |
| jeju\_surcharge\_amount | 

제주 추가 배송비

 |
| remote\_area\_surcharge\_amount | 

도서산간 추가 배송비

 |

### Retrieve shipping zone rates settings [](#retrieve-shipping-zone-rates-settings)cafe24

GET /api/v2/admin/regionalsurcharges

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 읽기권한 (mall.read\_shipping)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve shipping zone rates settings

*   [Retrieve shipping zone rates settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update regional surcharges [](#update-regional-surcharges)cafe24

PUT /api/v2/admin/regionalsurcharges

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 쓰기권한 (mall.write\_shipping)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| use\_regional\_surcharge | 

지역별 배송비 사용여부

T : 사용함  
F : 사용안함

 |
| region\_setting\_type | 

지역 설정 방식

A : 간편 설정  
N : 지명 설정  
Z : 우편번호 설정

 |
| jeju\_surcharge\_amount  

_최소: \[0\]~최대: \[999999999\]_

 | 

제주 추가 배송비

 |
| remote\_area\_surcharge\_amount  

_최소: \[0\]~최대: \[999999999\]_

 | 

도서산간 추가 배송비

 |

Update regional surcharges

*   [Update regional surcharges](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Shipping

배송(Shipping)은 쇼핑몰에 등록된 배송방법과 관련된 기능입니다.  
각각의 배송방법에 대한 상세 정보를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/shipping
PUT /api/v2/admin/shipping
```

#### \[더보기 상세 내용\]

### Shipping property list[](#shipping-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| shipping\_method | 

배송방법

shipping\_01 : 택배  
shipping\_02 : 빠른등기  
shipping\_04 : 직접배송  
shipping\_05 : 퀵배송  
shipping\_06 : 기타  
shipping\_07 : 화물배송  
shipping\_08 : 매장직접수령  
shipping\_09 : 배송필요 없음  
shipping\_10 : 고객직접선택

 |
| shipping\_etc | 

기타배송

 |
| shipping\_type | 

국내/해외배송 설정

A : 국내배송  
C : 해외배송  
B : 국내/해외배송

 |
| international\_shipping\_fee\_criteria | 

해외 배송비 기준 설정

B : 쇼핑몰 자체 배송비  
E : 자동 책정 배송비(EMS)

 |
| shipping\_place | 

배송지역

 |
| shipping\_period | 

배송기간

 |
| shipping\_fee\_type | 

배송비타입

T : 배송비 무료  
R : 고정배송비 사용  
M : 구매 금액에 따른 부과  
D : 구매 금액별 차등 배송료 사용  
W : 상품 무게별 차등 배송료 사용  
C : 상품 수량별 차등 배송료 사용  
N : 상품 수량에 비례하여 배송료 부과

 |
| shipping\_fee  

_최대값: \[999999999\]_

 | 

배송비

 |
| free\_shipping\_price  

_최대값: \[99999999999999\]_

 | 

배송비 무료 최소금액

배송비 설정 > 구매 금액에 따른 부과 일 경우 사용

 |
| shipping\_fee\_by\_quantity  

_최대값: \[999999999\]_

 | 

상품 수량별 배송비

배송비 설정 > 상품 수량에 비례하여 배송료 부과 일 경우 사용

 |
| shipping\_rates | 

배송비 상세 설정

 |
| shipping\_fee\_criteria | 

배송비 청구 기준 주문금액 조건 설정

D : 할인전 정상판매가격 기준(권장)  
L : 최종 주문(결제)금액 기준  
A : 할인 적용 후 결제 금액 기준  
R : 최종 실 결제금액 기준

 |
| prepaid\_shipping\_fee | 

배송비 선결제 설정

C : 착불  
P : 선결제  
B : 착불/선결제

 |
| product\_weight | 

상품중량

 |
| oversea\_shipping\_country | 

해외배송가능 국가 제한 여부

T : 제한함  
F : 제한안함

 |
| oversea\_shipping\_country\_list | 

배송국가

 |
| country\_shipping\_fee | 

배송비 국가별 개별 설정 여부

T : 사용함  
F : 사용안함

 |
| country\_shipping\_fee\_list | 

국가별 배송비

 |
| international\_shipping\_insurance | 

해외배송 보험료

T : 사용함  
F : 사용안함

 |
| return\_address | 

반품주소

 |
| package\_volume | 

배송규격

 |
| wished\_delivery\_date | 

희망배송일

 |
| wished\_delivery\_time | 

희망배송시간

 |
| hs\_code | 

HS코드

 |
| country\_hs\_code | 

국가별 HS 코드

 |
| oversea\_additional\_fee | 

해외배송 부가금액 사용여부

T : 사용함  
F : 사용안함

 |
| oversea\_additional\_fee\_list | 

해외배송 부가금액 적용국가

 |
| individual\_shipping\_fee | 

상품별 개별배송비 설정 여부

T : 사용함  
F : 사용안함

 |
| individual\_fee\_calculation\_type | 

개별배송비 계산 기준

P : 상품별  
I : 품목별

 |
| supplier\_shipping\_fee | 

공급사 배송비 사용 여부

T : 사용함  
F : 사용안함

 |
| supplier\_selection | 

공급사 배송비 사용 범위

A : 전체 공급사  
P : 특정 공급사

 |
| applicable\_suppliers | 

공급사 배송비 사용 공급사

 |
| supplier\_shipping\_calculation | 

공급사 배송비 계산 기준

A : 전체 상품금액 합계  
S : 대표운영자와 공급사 상품 별도 합계

 |
| supplier\_regional\_surcharge | 

공급사 지역별 배송비

A : 대표 운영자의 지역별 배송료를 부과  
S : 공급사 관리자 설정에 따라 부과

 |
| additional\_shipping\_fee | 

추가 배송비 설정

 |
| shipping\_company\_type | 

배송업체 선택

 |

### Retrieve shipping / return settings [](#retrieve-shipping-return-settings)cafe24 youtube

GET /api/v2/admin/shipping

###### GET

쇼핑몰에 등록된 배송방법에 대한 정보를 목록으로 조회할 수 있습니다.  
배송방법, 배송기간, 배송비 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 읽기권한 (mall.read\_shipping)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve shipping / return settings

*   [Retrieve shipping / return settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update store shipping/return settings [](#update-store-shipping-return-settings)cafe24 youtube

PUT /api/v2/admin/shipping

###### PUT

쇼핑몰에 등록된 배송방법에 대한 정보를 수정할 수 있습니다.  
배송방법, 배송기간 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 쓰기권한 (mall.write\_shipping)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| shipping\_method | 

배송방법

shipping\_01 : 택배  
shipping\_02 : 빠른등기  
shipping\_04 : 직접배송  
shipping\_05 : 퀵배송  
shipping\_06 : 기타  
shipping\_07 : 화물배송  
shipping\_08 : 매장직접수령  
shipping\_09 : 배송필요 없음  
shipping\_10 : 고객직접선택

 |
| shipping\_etc  

_최대글자수 : \[25자\]_

 | 

기타배송

 |
| shipping\_type | 

국내/해외배송 설정

A : 국내배송  
C : 해외배송  
B : 국내/해외배송

 |
| international\_shipping\_fee\_criteria | 

해외 배송비 기준 설정

B : 쇼핑몰 자체 배송비  
E : 자동 책정 배송비(EMS)

 |
| shipping\_place | 

배송지역

 |
| shipping\_period | 

배송기간

 |
| 

shipping\_period 하위 요소 보기

**minimum**  
최소 기간

**maximum**  
최대 기간







 |
| shipping\_fee\_type | 

배송비타입

T : 배송비 무료  
R : 고정배송비 사용  
M : 구매 금액에 따른 부과  
D : 구매 금액별 차등 배송료 사용  
W : 상품 무게별 차등 배송료 사용  
C : 상품 수량별 차등 배송료 사용  
N : 상품 수량에 비례하여 배송료 부과

 |
| shipping\_fee  

_최대값: \[999999999\]_

 | 

배송비

 |
| free\_shipping\_price  

_최대값: \[99999999999999\]_

 | 

배송비 무료 최소금액

 |
| shipping\_fee\_by\_quantity  

_최대값: \[999999999\]_

 | 

상품 수량별 배송비

 |
| shipping\_rates | 

배송비 상세 설정

 |
| 

shipping\_rates 하위 요소 보기

**min\_value**  
조건 최소값

**max\_value**  
조건 최대값

**shipping\_fee**  
배송비







 |
| shipping\_fee\_criteria | 

배송비 청구 기준 주문금액 조건 설정

D : 할인전 정상판매가격 기준(권장)  
A : 할인 적용 후 결제 금액 기준

 |
| prepaid\_shipping\_fee | 

배송비 선결제 설정

**EC 일본, 베트남, 필리핀 버전에서는 사용할 수 없음.**

C : 착불  
P : 선결제  
B : 착불/선결제

 |
| product\_weight  

_최소값: \[0\]_  
_최대값: \[30\]_

 | 

상품중량

 |
| oversea\_shipping\_country | 

해외배송가능 국가 제한 여부

T : 제한함  
F : 제한안함

 |
| oversea\_shipping\_country\_list | 

배송국가

 |
| 

oversea\_shipping\_country\_list 하위 요소 보기

**country\_code**  
국가코드







 |
| country\_shipping\_fee | 

배송비 국가별 개별 설정 여부

**EC 일본, 베트남, 필리핀 버전에서는 사용할 수 없음.**

T : 사용함  
F : 사용안함

 |
| country\_shipping\_fee\_list | 

국가별 배송비

**EC 일본, 베트남, 필리핀 버전에서는 사용할 수 없음.**

 |
| 

country\_shipping\_fee\_list 하위 요소 보기

**country\_code**  
국가코드

**conditional**  
배송비 책정 조건  
quantity : 수량  
weight : 무게  
price : 가격

**min\_value**  
조건 최소값

**max\_value**  
조건 최대값

**shipping\_fee**  
배송비







 |
| international\_shipping\_insurance | 

해외배송 보험료

**EC 한국 버전에서만 사용할 수 있음.**

T : 사용함  
F : 사용안함

 |
| return\_address | 

반품주소

 |
| 

return\_address 하위 요소 보기

**zipcode**  
우편번호

**ziptype**  
우편번호 선택 국가

**address1**  
기본 주소

**address2**  
상세 주소







 |
| package\_volume | 

배송규격

 |
| 

package\_volume 하위 요소 보기

**width**  
가로

**length**  
세로

**height**  
높이







 |
| individual\_shipping\_fee | 

상품별 개별배송비 설정 여부

T : 사용함  
F : 사용안함

 |
| individual\_fee\_calculation\_type | 

개별배송비 계산 기준

P : 상품별  
I : 품목별

 |
| additional\_shipping\_fee  

_글자수 최소: \[1자\]~최대: \[9자\]_  
_최소: \[0\]~최대: \[999999999\]_

 | 

추가 배송비 설정

 |
| shipping\_company\_type | 

배송업체 선택

 |
| 

shipping\_company\_type 하위 요소 보기

**carrier\_id**  
배송사 아이디

**is\_selected**  
선택여부  
T: 선택  
F: 선택안함







 |
| hs\_code  

_최대글자수 : \[20자\]_

 | 

HS코드

 |
| country\_hs\_code  

_배열 최대사이즈: \[29\]_

 | 

국가별 HS 코드

 |
| oversea\_additional\_fee | 

해외배송 부가금액 사용여부

T : 사용함  
F : 사용안함

 |
| oversea\_additional\_fee\_list  

_배열 최대사이즈: \[500\]_

 | 

해외배송 부가금액 적용국가

 |
| 

oversea\_additional\_fee\_list 하위 요소 보기

**country\_code**  
국가코드

**fee\_name**  
부과금액 명칭

**min\_value**  
조건 최소값

**max\_value**  
조건 최대값

**additional\_fee**  
부가금액

**unit**  
해외배송 부가금액 단위  
W : 정액  
P : 퍼센트

**rounding\_unit**  
절사단위  
F : 절사안함  
0 : 1원단위  
1 : 10원단위  
2 : 100원단위  
3 : 1000원단위

**rounding\_rule**  
절사 방법  
L : 내림  
U : 반올림  
C : 올림







 |

Update store shipping/return settings

*   [Update store shipping/return settings](#none)
*   [Update shipping period of the store](#none)
*   [Update return address of the store](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Shipping additionalfees

> Endpoints

```
GET /api/v2/admin/shipping/additionalfees
```

#### \[더보기 상세 내용\]

### Shipping additionalfees property list[](#shipping-additionalfees-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| oversea\_additional\_fee | 

해외배송 부가금액 사용여부

 |
| country\_code | 

국가코드

 |
| fee\_name | 

부과금액 명칭

 |
| min\_value | 

조건 최소값

 |
| max\_value | 

조건 최대값

 |
| additional\_fee | 

부가금액

 |
| unit | 

해외배송 부가금액 단위

W : 정액  
P : 퍼센트

 |
| rounding\_unit | 

절사단위

F : 절사안함  
0 : 1원단위  
1 : 10원단위  
2 : 100원단위  
3 : 1000원단위

 |
| rounding\_rule | 

절사 방법

L : 내림  
U : 반올림  
C : 올림

 |

### Retrieve a list of applicable countries for additional handling fee on international shipping [](#retrieve-a-list-of-applicable-countries-for-additional-handling-fee-on-international-shipping)cafe24 youtube

GET /api/v2/admin/shipping/additionalfees

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 읽기권한 (mall.read\_shipping)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| limit  

_최소: \[1\]~최대: \[500\]_

 | 

조회결과 최대건수

DEFAULT 100

 |
| offset  

_최대값: \[500\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a list of applicable countries for additional handling fee on international shipping

*   [Retrieve a list of applicable countries for additional handling fee on international shipping](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Shippingorigins

출고지 관리(Shipping origins)는 출고지에 대한 정보를 관리하는 기능입니다.

> Endpoints

```
GET /api/v2/admin/shippingorigins
GET /api/v2/admin/shippingorigins/{origin_code}
POST /api/v2/admin/shippingorigins
PUT /api/v2/admin/shippingorigins/{origin_code}
DELETE /api/v2/admin/shippingorigins/{origin_code}
```

#### \[더보기 상세 내용\]

### Shippingorigins property list[](#shippingorigins-property-list)

| **Attribute** | **Description** |
| --- | --- |
| **origin\_code**  
**Required**  
_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

출고지 코드

 |
| origin\_name  

_최대글자수 : \[50자\]_

 | 

출고지 명

 |
| default | 

출고지 기본설정 여부

T : 사용함  
F : 사용안함

 |
| country\_code  

_최대글자수 : \[2자\]_

 | 

국가코드

 |
| zipcode  

_최소글자수 : \[2자\]_  
_최대글자수 : \[14자\]_

 | 

우편번호

 |
| address1  

_최대글자수 : \[255자\]_

 | 

기본 주소

 |
| address2  

_최대글자수 : \[255자\]_

 | 

상세 주소

 |
| contact | 

대표 연락처

 |
| secondary\_contact | 

보조 연락처

 |
| variants | 

출고지 품목 정보

 |

### Retrieve a list of shipping origins [](#retrieve-a-list-of-shipping-origins)cafe24 youtube

GET /api/v2/admin/shippingorigins

###### GET

등록된 출고지를 목록으로 조회할 수 있습니다.  
품목 정보는 최대 100건까지 표기됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 읽기권한 (mall.read\_shipping)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| offset  
_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve a list of shipping origins

*   [Retrieve a list of shipping origins](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a shipping origin [](#retrieve-a-shipping-origin)cafe24 youtube

GET /api/v2/admin/shippingorigins/{origin\_code}

###### GET

등록된 출고지를 상세 조회할 수 있습니다.  
품목 정보가 100건 이후의 모든 값이 조회됩니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 읽기권한 (mall.read\_shipping)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **origin\_code**  
**Required**  
_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

출고지 코드

 |

Retrieve a shipping origin

*   [Retrieve a shipping origin](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a shipping origin [](#create-a-shipping-origin)cafe24 youtube

POST /api/v2/admin/shippingorigins

###### POST

배송 출고지로 활용될 출고지를 등록할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 쓰기권한 (mall.write\_shipping)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **origin\_name**  
**Required**  
_최대글자수 : \[50자\]_

 | 

출고지 명

 |
| **address1**  
**Required**  

_최대글자수 : \[255자\]_

 | 

기본 주소

 |
| **address2**  
**Required**  

_최대글자수 : \[255자\]_

 | 

상세 주소

 |
| **country\_code**  
**Required**  

_최대글자수 : \[2자\]_

 | 

국가코드

 |
| default | 

출고지 기본설정 여부

T : 사용함  
F : 사용안함

DEFAULT F

 |
| zipcode  

_최소글자수 : \[2자\]_  
_최대글자수 : \[14자\]_

 | 

우편번호

 |
| contact  

_전화번호_  
_최대글자수 : \[20자\]_

 | 

대표 연락처

 |
| secondary\_contact  

_전화번호_  
_최대글자수 : \[20자\]_

 | 

보조 연락처

 |

Create a shipping origin

*   [Create a shipping origin](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a shipping origin [](#update-a-shipping-origin)cafe24 youtube

PUT /api/v2/admin/shippingorigins/{origin\_code}

###### PUT

배송 출고지로 활용될 출고지를 등록할 수 있습니다.  
배송 관리자 활성화 시, 상품 및 품목별 출고지를 설정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 쓰기권한 (mall.write\_shipping)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **origin\_code**  
**Required**  
_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

출고지 코드

 |
| origin\_name  

_최대글자수 : \[50자\]_

 | 

출고지 명

 |
| country\_code  

_최대글자수 : \[2자\]_

 | 

국가코드

 |
| default | 

출고지 기본설정 여부

T : 사용함  
F : 사용안함

 |
| contact  

_전화번호_  
_최대글자수 : \[20자\]_

 | 

대표 연락처

 |
| secondary\_contact  

_전화번호_  
_최대글자수 : \[20자\]_

 | 

보조 연락처

 |
| zipcode  

_최소글자수 : \[2자\]_  
_최대글자수 : \[14자\]_

 | 

우편번호

 |
| address1  

_최대글자수 : \[255자\]_

 | 

기본 주소

 |
| address2  

_최대글자수 : \[255자\]_

 | 

상세 주소

 |

Update a shipping origin

*   [Update a shipping origin](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete a shipping origin [](#delete-a-shipping-origin)cafe24 youtube

DELETE /api/v2/admin/shippingorigins/{origin\_code}

###### DELETE

등록된 출고지를 삭제할 수 있습니다.  
기본출고지, 상품/품목이 할당된 출고지는 삭제할 수 없습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **배송 쓰기권한 (mall.write\_shipping)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **origin\_code**  
**Required**  
_형식 : \[A-Z0-9\]_  
_글자수 최소: \[8자\]~최대: \[8자\]_

 | 

출고지 코드

 |

Delete a shipping origin

*   [Delete a shipping origin](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Salesreport

## Financials dailysales

일별 매출(Financials dailysales)은 PG사별, 일별 매출 정보를 제공합니다.  
검색 조건에 부합하는 매출 정보 검색이 가능합니다.

> Endpoints

```
GET /api/v2/admin/financials/dailysales
```

#### \[더보기 상세 내용\]

### Financials dailysales property list[](#financials-dailysales-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| date | 

날짜

 |
| payment\_amount | 

결제 금액

 |
| refund\_amount | 

환불 금액

 |
| sales\_count | 

판매건수

 |

### Retrieve a list of daily sales [](#retrieve-a-list-of-daily-sales)cafe24 youtube

GET /api/v2/admin/financials/dailysales

###### GET

검색 시작일과 종료일, PG사 정보를 이용하여 매출 정보를 조회합니다.  
결제 금액, 환불 금액 등을 확인할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **매출통계 읽기권한 (mall.read\_salesreport)** |
| 호출건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **start\_date**  
**Required** | 
검색 시작일

 |
| **end\_date**  
**Required** | 

검색 종료일

 |
| payment\_gateway\_name | 

PG 이름

 |
| partner\_id | 

PG사 발급 가맹점 ID

 |
| payment\_method | 

결제수단 코드

card : 신용카드  
tcash : 계좌이체  
icash : 가상계좌  
point : 선불금  
cell : 휴대폰

 |

Retrieve a list of daily sales

*   [Retrieve a list of daily sales](#none)
*   [Retrieve dailysales with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Financials monthlysales

월별 매출(Financials monthlysales)은 PG사별, 월별 매출 정보를 제공합니다.  
검색 조건에 부합하는 매출 정보 검색이 가능합니다.

> Endpoints

```
GET /api/v2/admin/financials/monthlysales
```

#### \[더보기 상세 내용\]

### Financials monthlysales property list[](#financials-monthlysales-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| month | 

년월

 |
| payment\_amount | 

결제 금액

 |
| refund\_amount | 

환불 금액

 |
| sales\_count | 

판매건수

 |

### Retrieve a list of monthly sales [](#retrieve-a-list-of-monthly-sales)cafe24 youtube

GET /api/v2/admin/financials/monthlysales

###### GET

검색 시작월과 종료월, PG사 정보를 이용하여, 매출 정보를 조회합니다.  
결제 금액, 환불 금액 등을 확인할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **매출통계 읽기권한 (mall.read\_salesreport)** |
| 호출건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **start\_month**  
**Required** | 
검색 시작월

 |
| **end\_month**  
**Required** | 

검색 종료월

 |
| payment\_gateway\_name | 

PG 이름

 |
| partner\_id | 

PG사 발급 가맹점 ID

 |
| payment\_method | 

결제수단 코드

card : 신용카드  
tcash : 계좌이체  
icash : 가상계좌  
point : 선불금  
cell : 휴대폰

 |

Retrieve a list of monthly sales

*   [Retrieve a list of monthly sales](#none)
*   [Retrieve monthlysales with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Reports hourlysales

시간단위 정산통계(Reports hourlysales)는 특정 날짜와 시간을 기준으로 각종 매출에 관한 데이터를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/reports/hourlysales
```

#### \[더보기 상세 내용\]

### Reports hourlysales property list[](#reports-hourlysales-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| collection\_date | 

정산 수집 일자

 |
| collection\_hour | 

정산 수집 시간

 |
| order\_count | 

주문수

 |
| item\_count | 

품목수

 |
| order\_price\_amount | 

상품 구매금액

 |
| order\_sale\_price | 

할인금액

 |
| shipping\_fee | 

배송비

 |
| coupon\_discount\_price | 

쿠폰 할인금액

 |
| actual\_order\_amount | 

실결제금액

 |
| refund\_amount | 

환불 금액

 |
| sales | 

순매출

 |
| used\_points | 

적립금

 |
| used\_credits | 

예치금

 |
| used\_naver\_points | 

네이버 마일리지

 |
| used\_naver\_cash | 

네이버캐시

 |
| refund\_points | 

환불 적립금

 |
| refund\_credits | 

환불 예치금

 |
| refund\_naver\_points | 

환불 네이버 마일리지

 |
| refund\_naver\_cash | 

환불 네이버캐시

 |

### Retrieve hourly sales statistics of a store [](#retrieve-hourly-sales-statistics-of-a-store)cafe24 youtube

GET /api/v2/admin/reports/hourlysales

###### GET

특정 날짜와 시간을 기준으로 각종 매출에 관한 데이터를 목록으로 조회할 수 있습니다.  
주문수, 품목수, 구매금액, 할인금액 등을 조회할 수 있습니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **매출통계 읽기권한 (mall.read\_salesreport)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **start\_date**  
**Required**  

_날짜_

 | 

검색 시작일

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

 |
| collection\_hour | 

정산 수집 시간

수집 시간을 특정하여 검색  
00 ~ 23 까지의 값을 입력할 수 있다.

 |
| limit  

_최소: \[1\]~최대: \[1000\]_

 | 

조회결과 최대건수

DEFAULT 744

 |
| offset  

_최대값: \[10000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve hourly sales statistics of a store

*   [Retrieve hourly sales statistics of a store](#none)
*   [Retrieve hourlysales with fields parameter](#none)
*   [Retrieve a specific hourlysales with collection\_hour parameter](#none)
*   [Retrieve hourlysales using paging](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Reports productsales

상품판매통계(Reports productsales)를 활용하여 상품을 기준으로 판매된 통계를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/reports/productsales
```

#### \[더보기 상세 내용\]

### Reports productsales property list[](#reports-productsales-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| collection\_date | 

정산 수집 일자

 |
| collection\_hour | 

정산 수집 시간

 |
| product\_no | 

상품번호

 |
| variants\_code | 

품목코드

 |
| product\_price | 

상품 구매금액

 |
| settle\_count | 

결제완료 수량

 |
| refund\_count | 

환불완료 수량

 |
| sale\_count | 

판매완료 수량

 |
| return\_product\_count | 

반품완료 수량

 |
| exchange\_product\_count | 

교환완료 수량

 |
| cancel\_product\_count | 

취소완료 수량

 |
| total\_sale\_count | 

누적 판매 수량

 |
| total\_cancel\_count | 

누적 취소 수량

 |

### Retrieve hourly product sales statistics of a store [](#retrieve-hourly-product-sales-statistics-of-a-store)cafe24 youtube

GET /api/v2/admin/reports/productsales

###### GET

상품을 기준으로 판매통계를 조회할 수 있습니다.  
품목코드, 결제완료 수량, 환불완료 수량, 누적판매 수량 등을 조회할 수 있습니다.  
특정 기간과 시간을 기준으로도 조회가 가능합니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **매출통계 읽기권한 (mall.read\_salesreport)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **start\_date**  
**Required**  

_날짜_

 | 

검색 시작일

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

 |
| collection\_hour | 

정산 수집 시간

수집 시간을 특정하여 검색  
00 ~ 23 까지의 값을 입력할 수 있다.

 |
| limit  

_최소: \[1\]~최대: \[1000\]_

 | 

조회결과 최대건수

DEFAULT 100

 |
| offset  

_최대값: \[10000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve hourly product sales statistics of a store

*   [Retrieve hourly product sales statistics of a store](#none)
*   [Retrieve productsales with fields parameter](#none)
*   [Retrieve a specific productsales with collection\_hour parameter](#none)
*   [Retrieve productsales using paging](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Reports salesvolume

판매수량 통계(Reports salesvolume)는 쇼핑몰의 상품이 판매된 수량의 통계에 대한 기능입니다.  
판매수량은 주기적으로 집계하여 업데이트 되므로 실시간의 데이터는 아닌 점 참고 부탁 드립니다.

> Endpoints

```
GET /api/v2/admin/reports/salesvolume
```

#### \[더보기 상세 내용\]

### Reports salesvolume property list[](#reports-salesvolume-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| collection\_date | 

정산 수집 일자

판매량 통계가 수집된 수집 날짜

 |
| collection\_hour | 

정산 수집 시간

판매량 통계가 수집된 수집 시간

 |
| product\_price | 

상품 판매가

해당 상품의 가격

 |
| product\_option\_price | 

상품 옵션 가격

해당 품목의 옵션 추가 가격.

 |
| settle\_count | 

결제완료 수량

조회 기간동안 해당 품목이 결제 완료된 수량

 |
| exchane\_product\_count | 

교환완료 수량

조회 기간동안 해당 품목이 교환된 수량

 |
| cancel\_product\_count | 

취소완료 수량

조회 기간동안 해당 품목이 취소된 수량

 |
| return\_product\_count | 

반품완료 수량

조회 기간동안 해당 품목이 반품된 수량

 |
| updated\_date | 

최종 데이터 갱신 시간

판매 수량 통계 데이터가 갱신된 시간 표시

 |
| variants\_code | 

품목코드

해당 품목의 품목 코드

 |
| product\_no | 

상품번호

 |
| total\_sales | 

총 판매 건수

해당 품목이 검색한 기간 동안 총 판매된 수량

 |

### Retrieve a sales report [](#retrieve-a-sales-report)cafe24 youtube

GET /api/v2/admin/reports/salesvolume

###### GET

판매수량 통계를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **매출통계 읽기권한 (mall.read\_salesreport)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| product\_no | 

상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.  
  
조회시 상품번호(product\_no)와 품목코드(variant\_code) 둘 중에 하나는 반드시 포함하여야한다.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| variants\_code | 

품목코드

판매 수량을 검색할 품목 코드  
  
조회시 상품번호(product\_no)와 품목코드(variant\_code) 둘 중에 하나는 반드시 포함하여야한다.

 |
| category\_no | 

분류 번호

판매 수량 중 특정 카테고리에서 판매된 수량 조회

 |
| mobile | 

모바일 PC 여부

판매 수량 중 모바일 웹에서 판매된 수량 조회

T : 모바일  
F : 그외

 |
| delivery\_type | 

배송 유형

판매 수량 중 국내 또는 해외 배송 수량 조회

A : 국내  
B : 해외

 |
| group\_no | 

회원 등급 번호

 |
| supplier\_id  

_최대글자수 : \[20자\]_

 | 

공급사 아이디

판매 수량 중 특정 공급사 ID로 등록된 수량 조회

 |
| **start\_date**  
**Required**  

_날짜_

 | 

검색 시작일

판매 수량을 조회할 검색 시작일(결제일 기준)  
검색 종료일과 같이 사용해야함.

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

판매 수량을 조회할 검색 종료일(결제일 기준)  
검색 시작일과 같이 사용해야함.

 |

Retrieve a sales report

*   [Retrieve a sales report](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Personal

## Carts

장바구니(Carts)는 상품을 주문하기 전 한번에 주문할 수 있도록 상품을 미리 담아두는 기능입니다.  
장바구니 리소스에서는 Front API를 사용하여 특정 상품을 장바구니에 담을 수 있고 Admin API에서는 특정 회원의 장바구니를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/carts
```

#### \[더보기 상세 내용\]

### Carts property list[](#carts-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| basket\_product\_no | 

장바구니 상품번호

 |
| member\_id | 

회원아이디

 |
| created\_date | 

담은일자

 |
| product\_no | 

상품번호

 |
| additional\_option\_values | 

추가입력 옵션

 |
| variant\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

상품 품목 코드

 |
| quantity | 

수량

 |
| product\_price | 

상품 판매가

 |
| option\_price | 

옵션 추가 가격

 |
| product\_bundle | 

세트상품 여부

T : 세트상품  
F : 세트상품 아님

 |
| shipping\_type | 

배송 유형

A : 국내  
B : 해외

 |
| category\_no | 

분류 번호

 |

### Retrieve a shopping cart [](#retrieve-a-shopping-cart)cafe24

GET /api/v2/admin/carts

###### GET

회원 장바구니에 담긴 상품을 조회할 수 있습니다.  
한번에 여러 회원의 장바구니를 조회할 수 있습니다.  
회원아이디, 담은일자, 상품번호 등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **개인화정보 읽기권한 (mall.read\_personal)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required** | 

회원아이디

,(콤마)로 여러 건을 검색할 수 있다.

 |
| offset  

_최대값: \[10000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve a shopping cart

*   [Retrieve a shopping cart](#none)
*   [Retrieve carts with fields parameter](#none)
*   [Retrieve carts using paging](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Customers wishlist

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Customers%20wishlist.png)  
  
회원 관심상품(Customers wishlist)은 회원의 관심상품을 조회할 수 있는 관계형 리소스입니다.

> Endpoints

```
GET /api/v2/admin/customers/{member_id}/wishlist/count
GET /api/v2/admin/customers/{member_id}/wishlist
```

#### \[더보기 상세 내용\]

### Customers wishlist property list[](#customers__wishlist-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| wishlist\_no | 

관심상품번호

 |
| product\_no | 

상품번호

 |
| variant\_code  

_형식 : \[A-Z0-9\]_  
_글자수 최소: \[12자\]~최대: \[12자\]_

 | 

품목코드

시스템이 품목에 부여한 코드. 해당 쇼핑몰 내에서 품목 코드는 중복되지 않음.

 |
| additional\_option | 

추가입력 옵션

 |
| attached\_file\_option | 

파일 첨부 옵션

 |
| price | 

상품 판매가

상품의 판매 가격. 쿠폰 및 혜택을 적용하기 전의 가격.  
상품 등록시엔 모든 멀티 쇼핑몰에 동일한 가격으로 등록하며, 멀티쇼핑몰별로 다른 가격을 입력하고자 할 경우 상품 수정을 통해 가격을 다르게 입력할 수 있다.  
※ 판매가 = \[ 공급가 + (공급가 \* 마진율) + 추가금액 \]

 |
| product\_bundle | 

세트상품 여부

 |
| created\_date | 

담은일자

관심상품을 담은 일자

 |
| price\_content  

_최대글자수 : \[20자\]_

 | 

판매가 대체문구

 |

### Retrieve a count of products in customer wishlist [](#retrieve-a-count-of-products-in-customer-wishlist)cafe24

GET /api/v2/admin/customers/{member\_id}/wishlist/count

###### GET

특정 회원이 관심상품으로 등록한 상품 갯수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **개인화정보 읽기권한 (mall.read\_personal)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **member\_id**  
**Required** | 
회원아이디

 |
| shop\_no | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve a count of products in customer wishlist

*   [Retrieve a count of products in customer wishlist](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a list of products in customer wishlist [](#retrieve-a-list-of-products-in-customer-wishlist)cafe24

GET /api/v2/admin/customers/{member\_id}/wishlist

###### GET

특정 회원이 관심상품으로 등록한 상품을 목록으로 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **개인화정보 읽기권한 (mall.read\_personal)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **member\_id**  
**Required** | 
회원아이디

 |
| shop\_no | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve a list of products in customer wishlist

*   [Retrieve a list of products in customer wishlist](#none)
*   [Retrieve wishlist with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products carts

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Products%20carts.png)  
  
상품 장바구니(Products carts)는 특정 상품을 장바구니에 담은 회원과 그 숫자를 조회할 수 있는 리소스입니다.  
특정 상품을 장바구니에 담은 회원의 ID, 담은날짜와 회원의 수 정보를 조회할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/products/{product_no}/carts/count
GET /api/v2/admin/products/{product_no}/carts
```

#### \[더보기 상세 내용\]

### Products carts property list[](#products__carts-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| member\_id | 

회원아이디

 |
| created\_date | 

담은일자

 |
| product\_no | 

상품번호

 |
| variant\_code | 

상품 품목 코드

 |
| quantity | 

수량

 |
| product\_bundle | 

세트상품 여부

T : 세트상품  
F : 세트상품 아님

 |

### Retrieve a count of carts containing a product [](#retrieve-a-count-of-carts-containing-a-product)cafe24

GET /api/v2/admin/products/{product\_no}/carts/count

###### GET

특정 상품을 장바구니에 담은 회원의 수를 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **개인화정보 읽기권한 (mall.read\_personal)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

시스템에서 부여한 상품의 번호. 상품 번호는 쇼핑몰 내에서 중복되지 않는다.

 |

Retrieve a count of carts containing a product

*   [Retrieve a count of carts containing a product](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a list of carts containing a product [](#retrieve-a-list-of-carts-containing-a-product)cafe24

GET /api/v2/admin/products/{product\_no}/carts

###### GET

특정 상품을 장바구니에 담은 정보를 목록으로 확인합니다.  
회원아이디, 담은일자 등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **개인화정보 읽기권한 (mall.read\_personal)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |
| offset  

_최대값: \[10000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a list of carts containing a product

*   [Retrieve a list of carts containing a product](#none)
*   [Retrieve carts with fields parameter](#none)
*   [Retrieve carts using paging](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Privacy

## Customersprivacy

회원 개인정보(Customersprivacy)는 특정 회원의 개인정보에 대한 리소스입니다.  
민감한 개인정보가 포함되어 있으므로 사용에 주의를 기울여야 합니다.

> Endpoints

```
GET /api/v2/admin/customersprivacy
GET /api/v2/admin/customersprivacy/count
GET /api/v2/admin/customersprivacy/{member_id}
PUT /api/v2/admin/customersprivacy/{member_id}
```

#### \[더보기 상세 내용\]

### Customersprivacy property list[](#customersprivacy-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| name | 

이름

해당 회원의 이름

 |
| name\_english | 

영문이름

해당 회원의 영문 이름

 |
| name\_phonetic | 

발음표기 이름 (일본어)

해당 회원의 발음 표기 이름(일본어)

 |
| phone | 

전화번호

해당 회원의 일반전화

 |
| cellphone | 

휴대전화

해당 회원의 휴대전화

 |
| email | 

이메일

해당 회원의 이메일

 |
| sms | 

SMS 수신여부

SMS를 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함.

T : 수신  
F : 수신안함

 |
| news\_mail | 

뉴스메일 수신여부

이메일을 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함.

T : 수신  
F : 수신안함

 |
| thirdparty\_agree | 

제3자 제공 동의 여부

T : 동의함  
F : 동의안함

 |
| wedding\_anniversary  

_날짜_

 | 

결혼기념일

해당 회원의 결혼기념일

 |
| birthday  

_날짜_

 | 

생일

해당 회원의 생일

 |
| solar\_calendar | 

양력여부

생일이 양력인지 음력인지 여부

T : 양력  
F : 음력

 |
| total\_points | 

총 적립금

 |
| available\_points | 

가용 적립금

 |
| used\_points | 

사용 적립금

 |
| city  

_최대글자수 : \[255자\]_

 | 

시/군/도시

 |
| state  

_최대글자수 : \[255자\]_

 | 

주/도

 |
| address1  

_최대글자수 : \[255자\]_

 | 

기본 주소

해당 회원의 기본주소(시/군/도)

 |
| address2  

_최대글자수 : \[255자\]_

 | 

상세 주소

해당 회원의 상세주소

 |
| group\_no | 

회원등급번호

해당 회원의 회원등급의 번호

 |
| job\_class | 

직종

해당 회원의 직종

 |
| job | 

직업

해당 회원의 직업

 |
| zipcode  

_최대글자수 : \[14자\]_

 | 

우편번호

 |
| created\_date | 

가입일

해당 회원의 가입일시

 |
| member\_authentication | 

회원인증여부

회원 인증여부. 인증에 따라 회원은 4종류로 구분된다. 인증회원을 특별관리회원으로 설정할 경우 해당 회원은 가장 마지막에 설정한 특별관리회원으로 표시된다.

T : 인증  
F : 미인증  
B : 특별관리회원  
J : 14세미만회원

 |
| use\_blacklist | 

불량회원설정

불량회원 여부. 불량회원일 경우 불량회원 타입에 따라 상품구매 차단, 로그인 차단, 로그인과 상품구매 모두를 차단할 수 있음.

T : 설정함  
F : 설정안함

 |
| blacklist\_type | 

불량회원 차단설정

해당 회원의 불량회원 타입. 불량회원 타입에 따라 상품구매 차단, 로그인 차단, 로그인과 상품구매 모두를 차단할 수 있음.

P : 상품구매차단  
L : 로그인차단  
A : 로그인&상품구매 차단

 |
| last\_login\_date | 

최근 접속일시

해당 회원의 최종 로그인 일시

 |
| member\_authority | 

회원권한구분

회원 권한 구분. 회원 권한은 일반회원, 대표운영자, 부운영자, 공급사로 권한이 구분됨.

C : 일반회원  
P : 대표 운영자  
A : 부운영자  
S : 공급사

 |
| nick\_name  

_최대글자수 : \[50자\]_

 | 

운영자 별명

해당 회원의 별명

 |
| recommend\_id | 

추천인아이디

해당 회원의 가입당시 입력한 추천인 아이디

 |
| residence | 

지역코드

해당 회원의 주거지역

 |
| interest | 

관심분야

해당 회원의 관심사

 |
| gender | 

해당 회원의 성별

 |
| member\_type | 

회원타입

해당 회원의 회원 타입

p : 개인  
c : 사업자  
f : 외국인

 |
| company\_type | 

사업자 구분

해당 회원의 회원타입이 사업자일경우

p : 개인사업자  
c : 법인사업자

 |
| foreigner\_type | 

외국인 인증방법

해당 외국인 회원의 인증방법

f : 외국인등록번호  
p : 여권번호  
d : 국제운전면허증

 |
| authentication\_method | 

인증 수단

null : 인증안함  
i : 아이핀인증  
m : 휴대폰 본인인증  
e : 이메일인증  
d : 휴대폰 인증(중복 확인)  
a : 앱 인증(기타 인증)

 |
| lifetime\_member | 

평생회원 동의여부

T : 동의함 F : 동의안함

 |
| corporate\_name | 

법인명

해당 회원의 법인명

 |
| nationality | 

국적

해당 회원이 "외국인 회원"일 경우, 해당 회원의 국적

 |
| shop\_name | 

쇼핑몰명

해당 회원의 상호명

 |
| country\_code | 

국가코드

해당 회원이 가입시 입력한 국가

 |
| use\_mobile\_app | 

모바일앱 사용여부

해당 회원의 모바일앱 사용여부

T : 사용  
F : 사용안함

 |
| join\_path | 

가입경로

P : PC  
M : 모바일

 |
| fixed\_group | 

회원등급 고정 여부

특정 회원이 회원자동등급변경에 적용되지 않기 위한 등급 고정 여부  
회원자동등급변경 기능을 사용하는 몰에서만 사용 가능하다.

T : 고정함  
F : 고정안함

 |
| refund\_bank\_code  

_최대글자수 : \[20자\]_

 | 

환불 은행 코드

 |
| refund\_bank\_account\_no  

_최대글자수 : \[40자\]_

 | 

환불 계좌번호

 |
| refund\_bank\_account\_holder | 

환불계좌 예금주 명의

 |
| company\_condition  

_최대글자수 : \[50자\]_

 | 

업태

 |
| company\_line  

_최대글자수 : \[50자\]_

 | 

종목

 |
| sns\_list | 

연동중인 SNS

 |
| account\_reactivation\_date | 

휴면회원 해제일

 |
| available\_credits | 

가용 예치금

 |
| additional\_information | 

추가항목

해당 회원의 추가항목

 |

### Retrieve a list of customer information [](#retrieve-a-list-of-customer-information)cafe24 youtube

GET /api/v2/admin/customersprivacy

###### GET

쇼핑몰에 가입한 회원들을 목록으로 조회합니다.  
회원아이디, 이름, 휴대전화 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **개인정보 읽기권한 (mall.read\_privacy)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| search\_type | 

검색 타입

**Youtube shopping 이용 시에는 미제공**

회원 검색을 회원정보 기반으로 할지 가입일 기준으로 할지 선택하여 검색할 수 있다.  
가입일 기준으로 검색할 경우 offset과 ���계 없이 전체 회원을 검색할 수 있다.  
  
※ 가입일 기준 사용시 created\_start\_date 외의 모든 검색 조건은 사용할 수 없다.

customer\_info : 회원정보 기반 검색  
created\_date : 가입일 기준 검색

DEFAULT customer\_info

 |
| created\_start\_date  

_날짜_

 | 

가입일 기준 검색시 검색 시작일

**Youtube shopping 이용 시에는 미제공**

search\_type이 created\_date 일 경우 가입일 기준의 검색 시작일. 해당 가입일 이후에 가입한 회원을 검색할 수 있다.

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| news\_mail | 

뉴스메일 수신여부

**Youtube shopping 이용 시에는 미제공**

이메일을 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함.

T : 수신  
F : 수신안함

 |
| sms | 

SMS 수신여부

SMS를 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함.

T : 수신  
F : 수신안함

 |
| thirdparty\_agree | 

제3자 제공 동의 여부

**Youtube shopping 이용 시에는 미제공**

T : 동의함  
F : 동의안함

 |
| group\_no | 

회원등급번호

**Youtube shopping 이용 시에는 미제공**

해당 회원의 회원등급의 번호

 |
| search\_field | 

검색필드

**Youtube shopping 이용 시에는 미제공**

조회하고자 하는 회원의 검색필드.

id : 아이디  
name : 이름  
hp : 핸드폰  
tel : 전화번호  
mail : 이메일  
shop\_name : 상호명

 |
| keyword | 

검색어

**Youtube shopping 이용 시에는 미제공**

조회하고자 하는 회원의 검색필드에 대한 검색어를 입력함.  
ex) search\_field : mail  
keyword : cafe24@cafe24.com

,(콤마)로 여러 건을 검색할 수 있다.

 |
| date\_type | 

검색날짜 유형

**Youtube shopping 이용 시에는 미제공**

조회의 기준이 되는 검색필드. '회원가입일' 기준으로 검색할 경우 검색시작일과 검색종료일의 기간은 회원가입일 기준이 됨.

join : 회원가입일  
login : 최근접속일  
age : 생년월일  
account\_reactivation : 휴면해제일  
wedding : 결혼기념일

 |
| start\_date  

_날짜_

 | 

검색 시작일

**Youtube shopping 이용 시에는 미제공**

특정 조회기준에 대한 검색 시작일.  
검색 종료일과 같이 사용해야함.  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색함.  
ex) 2018-12-31 00:00:00

 |
| end\_date  

_날짜_

 | 

검색 종료일

**Youtube shopping 이용 시에는 미제공**

특정 조회기준에 대한 검색 종료일.  
검색 시작일과 같이 사용해야함.  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색함.  
ex) 2018-12-31 23:59:59

 |
| member\_type | 

회원타입

**Youtube shopping 이용 시에는 미제공**

해당 회원의 회원 타입

vip : 특별관리회원  
poor : 블랙리스트  
pointfy : 통합멤버쉽 사용자

 |
| member\_class | 

회원구분

**Youtube shopping 이용 시에는 미제공**

**EC 일본, 베트남 버전에서는 사용할 수 없음.**

p : 개인  
c : 사업자  
f : 외국인

 |
| residence | 

지역코드

**Youtube shopping 이용 시에는 미제공**

해당 회원의 주거지역

,(콤마)로 여러 건을 검색할 수 있다.

 |
| gender | 

성별

**Youtube shopping 이용 시에는 미제공**

해당 회원의 성별

M : 남자  
F : 여자

 |
| member\_authority | 

회원권한구분

**Youtube shopping 이용 시에는 미제공**

회원 권한 구분. 회원 권한은 일반회원, 대표운영자, 부운영자, 공급사로 권한이 구분됨.

C : 일반회원  
P : 대표 운영자  
A : 부운영자  
S : 공급사

DEFAULT C

 |
| join\_path | 

가입경로

**Youtube shopping 이용 시에는 미제공**

P : PC  
M : 모바일

 |
| use\_mobile\_app | 

모바일앱 사용여부

**Youtube shopping 이용 시에는 미제공**

T : 사용  
F : 사용안함

 |
| fixed\_group | 

회원등급 고정 여부

**Youtube shopping 이용 시에는 미제공**

T : 고정함  
F : 고정안함

 |
| is\_simple\_join | 

주문서 간단회원가입 조회 여부

**Youtube shopping 이용 시에는 미제공**

T : 조회  
F : 조회 안 함

 |
| limit  

_최소: \[1\]~최대: \[1000\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 30

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

search\_type이 created\_date 일 경우 creted\_start\_date를 증가시키면서 전체 회원을 검색할 수 있으므로 offset은 사용할 수 없다.

DEFAULT 0

 |

Retrieve a list of customer information

*   [Retrieve a list of customer information](#none)
*   [Retrieve a specific customer using member\_id](#none)
*   [Retrieive customers using fields parameter](#none)
*   [Retrieve customers using paging](#none)
*   [Retrieve customers using created\_start\_date instead of offset to retrieve all customers](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of customer information [](#retrieve-a-count-of-customer-information)cafe24 youtube

GET /api/v2/admin/customersprivacy/count

###### GET

쇼핑몰에 가입한 회원들의 수를 조회합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **개인정보 읽기권한 (mall.read\_privacy)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| search\_type | 

검색 타입

**Youtube shopping 이용 시에는 미제공**

회원 검색을 회원정보 기반으로 할지 가입일 기준으로 할지 선택하여 검색할 수 있다.  
가입일 기준으로 검색할 경우 offset과 관계 없이 전체 회원을 검색할 수 있다.  
  
※ 가입일 기준 사용시 created\_start\_date 외의 모든 검색 조건은 사용할 수 없다.

customer\_info : 회원정보 기반 검색  
created\_date : 가입일 기준 검색

DEFAULT customer\_info

 |
| created\_start\_date  

_날짜_

 | 

가입일 기준 검색시 검색 시작일

**Youtube shopping 이용 시에는 미제공**

search\_type이 created\_date 일 경우 가입일 기준의 검색 시작일. 해당 가입일 이후에 가입한 회원을 검색할 수 있다.

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| news\_mail | 

뉴스메일 수신여부

**Youtube shopping 이용 시에는 미제공**

이메일을 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함.

T : 수신  
F : 수신안함

 |
| sms | 

SMS 수신여부

이벤트 SMS를 수신할지 여부. '수신거부' 시 광고, 영리성 목적 외 서비스에 필요한 주요 메일은 정상적으로 수신함.

T : 수신  
F : 수신안함

 |
| thirdparty\_agree | 

제3자 제공 동의 여부

**Youtube shopping 이용 시에는 미제공**

T : 동의함  
F : 동의안함

 |
| group\_no | 

회원등급번호

**Youtube shopping 이용 시에는 미제공**

해당 회원의 회원등급의 번호

 |
| search\_field | 

검색필드

**Youtube shopping 이용 시에는 미제공**

조회하고자 하는 회원의 검색필드.

id : 아이디  
name : 이름  
hp : 핸드폰  
tel : 전화번호  
mail : 이메일  
shop\_name : 상호명

 |
| keyword | 

검색어

**Youtube shopping 이용 시에는 미제공**

,(콤마)로 여러 건을 검색할 수 있다.

 |
| date\_type | 

검색날짜 유형

**Youtube shopping 이용 시에는 미제공**

join : 회원가입일  
login : 최근접속일  
age : 생년월일  
account\_reactivation : 휴면해제일  
wedding : 결혼기념일

 |
| start\_date  

_날짜_

 | 

검색 시작일

**Youtube shopping 이용 시에는 미제공**

특정 조회기준에 대한 검색 시작일.  
검색 종료일과 같이 사용해야함.  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색함.  
ex) 2018-12-31 00:00:00

 |
| end\_date  

_날짜_

 | 

검색 종료일

**Youtube shopping 이용 시에는 미제공**

특정 조회기준에 대한 검색 종료일.  
검색 시작일과 같이 사용해야함.  
검색 시작일과 종료일이 동일할 경우 해당 날짜로만 검색함.  
ex) 2018-12-31 23:59:59

 |
| member\_type | 

회원타입

**Youtube shopping 이용 시에는 미제공**

해당 회원의 회원 타입

vip : 특별관리회원  
poor : 블랙리스트  
pointfy : 통합멤버쉽 사용자

 |
| member\_class | 

회원구분

**Youtube shopping 이용 시에는 미제공**

**EC 일본, 베트남 버전에서는 사용할 수 없음.**

p : 개인  
c : 사업자  
f : 외국인

 |
| residence | 

지역코드

**Youtube shopping 이용 시에는 미제공**

해당 회원의 주거지역  
(,(콤마)로 여러 건을 검색할 수 있다.)누락

,(콤마)로 여러 건을 검색할 수 있다.

 |
| gender | 

성별

**Youtube shopping 이용 시에는 미제공**

해당 회원의 성별

M : 남자  
F : 여자

 |
| member\_authority | 

회원권한구분

**Youtube shopping 이용 시에는 미제공**

회원 권한 구분. 회원 권한은 일반회원, 대표운영자, 부운영자, 공급사로 권한이 구분됨.

C : 일반회원  
P : 대표 운영자  
A : 부운영자  
S : 공급사

DEFAULT C

 |
| join\_path | 

가입경로

**Youtube shopping 이용 시에는 미제공**

P : PC  
M : 모바일

 |
| use\_mobile\_app | 

모바일앱 사용여부

**Youtube shopping 이용 시에는 미제공**

T : 사용  
F : 사용안함

 |
| fixed\_group | 

회원등급 고정 여부

**Youtube shopping 이용 시에는 미제공**

T : 고정함  
F : 고정안함

 |
| is\_simple\_join | 

주문서 간단회원가입 조회 여부

**Youtube shopping 이용 시에는 미제공**

T : 조회  
F : 조회 안 함

 |

Retrieve a count of customer information

*   [Retrieve a count of customer information](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a customer information [](#retrieve-a-customer-information)cafe24 youtube

GET /api/v2/admin/customersprivacy/{member\_id}

###### GET

회원아이디를 이용하여 회원을 조회합니다.  
이름, 영문이름, 휴대전화번호, 이메일 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **개인정보 읽기권한 (mall.read\_privacy)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.

DEFAULT 1

 |
| **member\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |

Retrieve a customer information

*   [Retrieve a customer information](#none)
*   [Retrieve a customersprivacy with fields parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a customer information [](#update-a-customer-information)cafe24 youtube

PUT /api/v2/admin/customersprivacy/{member\_id}

###### PUT

회원아이디를 이용하여 회원정보를 수정합니다.  
SMS 수신여부, 생일, 주소 등을 변경합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **개인정보 쓰기권한 (mall.write\_privacy)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| cellphone | 

휴대전화

 |
| email  

_이메일_

 | 

이메일

 |
| sms | 

SMS 수신여부

T : 수신  
F : 수신안함

 |
| news\_mail | 

뉴스메일 수신여부

**Youtube shopping 이용 시에는 미제공**

T : 수신  
F : 수신안함

 |
| thirdparty\_agree | 

제3자 제공 동의 여부

**Youtube shopping 이용 시에는 미제공**

T : 동의함  
F : 동의안함

 |
| birthday  

_날짜_

 | 

생일

**Youtube shopping 이용 시에는 미제공**

 |
| solar\_calendar | 

양력여부

**Youtube shopping 이용 시에는 미제공**

T : 양력  
F : 음력

 |
| address1  

_최대글자수 : \[255자\]_

 | 

기본 주소

**Youtube shopping 이용 시에는 미제공**

 |
| address2  

_최대글자수 : \[255자\]_

 | 

상세 주소

**Youtube shopping 이용 시에는 미제공**

 |
| zipcode  

_최대글자수 : \[14자\]_

 | 

우편번호

**Youtube shopping 이용 시에는 미제공**

 |
| recommend\_id  

_최대글자수 : \[20자\]_

 | 

추천인아이디

**Youtube shopping 이용 시에는 미제공**

 |
| gender | 

성별

**Youtube shopping 이용 시에는 미제공**

M : 남자  
F : 여자

 |
| country\_code | 

국가코드

**Youtube shopping 이용 시에는 미제공**

 |
| additional\_information | 

추가항목

**Youtube shopping 이용 시에는 미제공**

 |
| 

additional\_information 하위 요소 보기

**key**  
추가항목 키

**value**  
추가항목 값







 |
| city  

_최대글자수 : \[255자\]_

 | 

시/군/도시

**Youtube shopping 이용 시에는 미제공**

 |
| state  

_최대글자수 : \[255자\]_

 | 

주/도

**Youtube shopping 이용 시에는 미제공**

 |
| refund\_bank\_code  

_최대글자수 : \[20자\]_

 | 

환불 은행 코드

**Youtube shopping 이용 시에는 미제공**

 |
| refund\_bank\_account\_no  

_최대글자수 : \[40자\]_

 | 

환불 계좌번호

**Youtube shopping 이용 시에는 미제공**

 |
| refund\_bank\_account\_holder | 

환불계좌 예금주 명의

**Youtube shopping 이용 시에는 미제공**

 |
| fixed\_group | 

회원등급 고정 여부

**Youtube shopping 이용 시에는 미제공**

T : 고정함  
F : 고정안함

 |

Update a customer information

*   [Update a customer information](#none)
*   [Update member's consent of receiving email and sms](#none)
*   [Update address information of the member](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Products wishlist customers

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Products%20wishlist%20customers.png)  
  
상품을 관심상품으로 담은 회원(Products wishlist customers)은 상품을 관심상품으로 담은 회원을 조회할 수 있는 리소스입니다.

> Endpoints

```
GET /api/v2/admin/products/{product_no}/wishlist/customers
GET /api/v2/admin/products/{product_no}/wishlist/customers/count
```

#### \[더보기 상세 내용\]

### Products wishlist customers property list[](#products__wishlist-customers-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| member\_id | 

회원아이디

 |

### Retrieve a list of customers with a product in wishlist [](#retrieve-a-list-of-customers-with-a-product-in-wishlist)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/wishlist/customers

###### GET

특정 상품을 관심상품에 담은 회원의 목록을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **개인정보 읽기권한 (mall.read\_privacy)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **product\_no**  
**Required** | 
상품번호

상품의 고유한 일련 번호. 해당 쇼핑몰 내에서 상품 번호는 중복되지 않음.

 |
| shop\_no | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve a list of customers with a product in wishlist

*   [Retrieve a list of customers with a product in wishlist](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a count of customers with a product in wishlist [](#retrieve-a-count-of-customers-with-a-product-in-wishlist)cafe24 youtube

GET /api/v2/admin/products/{product\_no}/wishlist/customers/count

###### GET

특정 상품을 관심상품에 담은 회원 수를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **개인정보 읽기권한 (mall.read\_privacy)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **product\_no**  
**Required** | 
상품번호

 |
| shop\_no | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve a count of customers with a product in wishlist

*   [Retrieve a count of customers with a product in wishlist](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Mileage

## Credits

예치금(Credits)는 주문 환불시 환불수단으로서 받을 수 있는 현금성 자산입니다.  
별도의 Scope를 가지고 있으며 매우 민감한 API 이므로 이용에 주의를 기울여야 합니다.

> Endpoints

```
GET /api/v2/admin/credits
```

#### \[더보기 상세 내용\]

### Credits property list[](#credits-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| issue\_date | 

등록일

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| group\_name | 

회원등급명

 |
| increase\_amount | 

지급 금액

 |
| decrease\_amount | 

차감 금액

 |
| balance | 

잔액

 |
| admin\_id | 

관리자 아이디

 |
| admin\_name | 

관리자 이름

 |
| reason | 

처리사유

 |
| case | 

예치금 유형

 |
| order\_id | 

주문번호

 |

### Retrieve a list of credits by date range [](#retrieve-a-list-of-credits-by-date-range)cafe24

GET /api/v2/admin/credits

###### GET

예치금을 목록으로 조회합니다.  
회원아이디, 지금 금액, 예치금 유형등을 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **적립금 읽기권한 (mall.read\_mileage)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **start\_date**  
**Required**  

_날짜_

 | 

검색 시작일

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

 |
| type | 

예치금 증가/차감 여부

I : 지급내역  
D : 차감내역

 |
| case | 

예치금 유형

A : 주문취소  
B : 예치금환불  
C : 상품구매  
D : 임의조정  
E : 현금환불  
G : 충전

 |
| admin\_id | 

관리자 아이디

 |
| order\_id  

_주문번호_

 | 

주문번호

 |
| search\_field | 

검색필드

id : 아이디  
reason : 처리사유

 |
| keyword | 

검색어

 |
| limit  

_최소: \[1\]~최대: \[200\]_

 | 

조회결과 최대건수

DEFAULT 50

 |
| offset  

_최대값: \[10000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve a list of credits by date range

*   [Retrieve a list of credits by date range](#none)
*   [Retrieve credits with fields parameter](#none)
*   [Retrieve credits using paging](#none)
*   [Retrieve a specific credits with case parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Credits report

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Credits%20report.png)  
  
예치금 통계(Credit report)는 지정한 기간동안의 예치금 통계를 조회할 수 있는 리소스입니다.

> Endpoints

```
GET /api/v2/admin/credits/report
```

#### \[더보기 상세 내용\]

### Credits report property list[](#credits-report-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| increase\_amount | 

지급 금액

 |
| decrease\_amount | 

차감 금액

 |
| credits\_total | 

예치금 합계

 |

### Retrieve a credit report by date range [](#retrieve-a-credit-report-by-date-range)cafe24

GET /api/v2/admin/credits/report

###### GET

예치금 통계를 조회합니다.  
지급 금액, 차감 금액, 예치금 합계를 확인할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **적립금 읽기권한 (mall.read\_mileage)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| **start\_date**  
**Required**  

_날짜_

 | 

검색 시작일

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

 |
| type | 

예치금 증가/차감 여부

I : 지급내역  
D : 차감내역

 |
| case | 

예치금 유형

A : 주문취소  
B : 예치금환불  
C : 상품구매  
D : 임의조정  
E : 현금환불  
G : 충전

 |
| admin\_id | 

관리자 아이디

 |
| search\_field | 

검색필드

id : 아이디  
reason : 처리사유

 |
| keyword | 

검색어

 |

Retrieve a credit report by date range

*   [Retrieve a credit report by date range](#none)
*   [Retrieve report with fields parameter](#none)
*   [Retrieve a specific report with case parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Points

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Points.png)  
  
적립금(Points)은 쇼핑몰 회원의 적립금의 조회, 증가, 차감을 할 수 있는 기능입니다.  
적립금은 매우 민감한 기능이므로 이용에 주의를 기울여야 합니다.

> Endpoints

```
GET /api/v2/admin/points
POST /api/v2/admin/points
```

#### \[더보기 상세 내용\]

### Points property list[](#points-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| case | 

적립금 타입

 |
| member\_id | 

회원아이디

 |
| email | 

이메일

 |
| group\_name | 

회원등급명

 |
| available\_points\_increase | 

적립금 증가

 |
| available\_points\_decrease | 

적립금 차감

 |
| available\_points\_total | 

가용 적립금

 |
| unavailable\_points | 

미가용 적립금

 |
| order\_date | 

주문일

 |
| issue\_date | 

적립금 지급일

 |
| available\_date | 

미가용 적립금 사용 가능일

 |
| admin\_id | 

관리자 아이디

 |
| admin\_name | 

관리자 이름

 |
| order\_id | 

주문번호

 |
| reason | 

적립 사유

적립금을 증가/차감하는 사유를 입력할 수 있다.

 |
| amount | 

적립금 증감액

1회당 최대 1,000,000원 이하까지 적립금을 지급할 수 있음.  
가용 적립금보다 큰 금액을 차감할 수 없다.

 |
| type | 

적립금 증가/차감 여부

적립금을 증가시킬지 차감시킬지 여부를 선택할 수 있다.

 |

### Retrieve points [](#retrieve-points)cafe24

GET /api/v2/admin/points

###### GET

회원의 적립금을 조회할 수 있습니다.  
지급 또는 차감된 적립금 각각에 대하여 타입과 사유 등을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **적립금 읽기권한 (mall.read\_mileage)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| email  

_이메일_

 | 

이메일

 |
| order\_id  

_최대글자수 : \[100자\]_

 | 

주문아이디

 |
| group\_no | 

회원등급번호

 |
| **start\_date**  
**Required**  

_날짜_

 | 

검색 시작일

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

 |
| case | 

적립금 타입

적립금 타입 지정 없이 전체 조회시에는 D: 적립금 환불 타입은 제외되고 조회 되므로, 적립금 환불 타입을 조회하려면 타입을 지정해야 합니다.

A : 관리자 직접 적립금 부여  
B : 주문취소로 인한 환불시 환불금을 적립금으로 부여  
C : 적립대기중이던 적립금 취소  
D : 반품완료 후 사용가능  
E : csv파일로 등록된 회원  
F : 주문취소로 인해 상품에 대한 적립금 차감  
G : 추천한 신규 가입자에게 적립금 부여  
H : (기존 적립금 내역용 레거시 타입) 주문시 회원등급에 따른 적립금 부여(회원 등급 적립금)  
I : 주문취소로 인해 회원등급에 대한 적립금 환불  
J : 주문취소로 인해 쿠폰에 대한 적립금 환불  
K : 주문시 회원등급에 따른 적립금 부여(회원 등급 적립금)  
L : 주문시 사용한 쿠폰에 따른 적립금 부여(쿠폰 적립금)  
M : 상품구매시 사용한 적립금  
N : 신규가입시 적립금 부여  
O : 적립금 즉시지급 쿠폰(온라인/시리얼)  
P : 주문시 구매한 상품에 대한 적립금 부여(구매에 대한 적립금)  
Q : 즐겨찾기 적립금  
R : 추천받은 기존 가입자에게 적립금 부여  
S : 주문취소시 구매에 사용한 적립금 부여(적립금 복원(주문취소))  
T : 뉴스레터 동의 적립금  
U : 바로가기(링콘) 설치 후 로그인  
V : 피추천인 주문취소에 따른 감사적립금 차감  
W : 피추천인 주문에 따른 감사적립금 부여  
X : 바로가기(링콘) 접속 후 구매에 따른 추가 적립금 부여  
Y : (기존 적립금 내역용 레거시 타입) 주문시 구매한 상품에 대한 적립금 부여(구매에 대한 적립금)  
Z : 바로가기 아이콘 설치  
AA : 바로가기(링콘) 접속 후 구매에 따른 추가 적립금 차감  
AB : 적립금 소멸  
AD : 회원정보 이벤트 참여 적립금  
AE : 플러스앱 주문 적립금  
AF : 주문취소에 의한 플러스앱주문 적립금 차감  
AG : 오프라인구매-적립금 사용  
AH : 오프라인취소-구매시 사용한 적립금 복원  
AI : 이벤트팩토리 적립금  
AK : 플러스앱 푸시알림 ON 적립금  
AL : 플러스앱 설치 적립금  
AM : API 를 통한 적립금  
AN : 플러스앱 푸시 혜택받기로 인한 적립금  
AO : 구매 확정 취소에 의한 플러스앱 적립금 차감  
AP : 구매 확정 취소에 의한 쿠폰 적립금 차감  
AQ : 구매 확정 취소에 의한 회원등급 적립금 차감  
AR : 구매 확정 취소에 의한 상품 적립금 차감  
AS : 구매 확정 취소에 의한 링콘 적립금 차감  
1 : SMS 수신동의 + 이메일 수신동의 적립금  
2 : SMS 수신동의 적립금  
3 : 회원 정보 수정 이벤트  
4 : 오프라인취소-구매시 지급한 적립금 회수  
5 : 오프라인구매-적립금 지급  
6 : \[품목추가\] 관리자 직접 지급 \[상품\] 적립금  
7 : \[품목추가\] 관리자 직접 지급 \[회원\] 적립금  
8 : \[품목교환\] 관리자 직접 지급 \[상품\] 적립금  
9 : \[품목교환\] 관리자 직접 지급 \[회원\] 적립금

 |
| points\_category | 

적립금 내역

available: 가용적립금  
unavailable: 미가용 적립금  
unavailable\_coupon: 미가용회원/쿠폰적립금

DEFAULT available

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve points

*   [Retrieve points](#none)
*   [Retrieve points with fields parameter](#none)
*   [Retrieve points using paging](#none)
*   [Retrieve a specific points with member\_id parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Issue and deduct points [](#issue-and-deduct-points)cafe24

POST /api/v2/admin/points

###### POST

회원의 적립금의 증가, 차감 처리를 할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **적립금 쓰기권한 (mall.write\_mileage)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

멀티쇼핑몰 구분을 위해 사용하는 멀티쇼핑몰 번호.  
SMS는 한국어 멀티쇼핑몰에서만 발송 가능하다.

DEFAULT 1

 |
| **member\_id**  
**Required**  

_최대글자수 : \[20자\]_

 | 

회원아이디

회원 아이디

 |
| order\_id  

_주문번호_

 | 

주문번호

 |
| **amount**  
**Required**  

_최소값: \[0\]_

 | 

적립금 증감액

1회당 최대 1,000,000원 이하까지 적립금을 지급할 수 있음.  
가용 적립금보다 큰 금액을 차감할 수 없다.

 |
| **type**  
**Required** | 

적립금 증가/차감 여부

적립금을 증가시킬지 차감시킬지 여부를 선택할 수 있다.

increase : 증가  
decrease : 차감

 |
| reason | 

적립 사유

적립금을 증가/차감하는 사유를 입력할 수 있다.

 |

Issue and deduct points

*   [Issue and deduct points](#none)
*   [Increase point of a certain customer using only member\_id, amount, and type fields](#none)
*   [Decrease point of a certain customer using only member\_id, amount, and type fields](#none)
*   [Try increasing point of a certain customer without using amount field](#none)
*   [Try increasing point of a certain customer without using type field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Points autoexpiration

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Points%20autoexpiration.png)  
  
포인트 자동만료(Points autoexpiration)는 포인트를 자동으로 만료시키는 것과 관련된 기능입니다.  
자동만료 설정을 조회하거나 등록 및 삭제가 가능합니다.

> Endpoints

```
GET /api/v2/admin/points/autoexpiration
POST /api/v2/admin/points/autoexpiration
DELETE /api/v2/admin/points/autoexpiration
```

#### \[더보기 상세 내용\]

### Points autoexpiration property list[](#points-autoexpiration-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| expiration\_date | 

최초 소멸 시행일

 |
| interval\_month | 

소멸 실행 주기

1: 1개월  
3: 3개월  
6: 6개월  
12: 1년

 |
| target\_period\_month | 

소멸 대상 적립금

6: 소멸일 기준 6개월 이전 적립금  
12: 소멸일 기준 1년 이전 적립금  
18: 소멸일 기준 1년 6개월 이전 적립금  
24: 소멸일 기준 2년 이전 적립금  
30: 소멸일 기준 2년 6개월 이전 적립금  
36: 소멸일 기준 3년 이전 적립금

 |
| group\_no | 

소멸 대상 회원등급

0: 전체 회원

 |
| standard\_point | 

소멸 대상 기준 금액

 |
| send\_email | 

이메일 발송

T: 설정함  
F: 설정안함

 |
| send\_sms | 

SMS 발송

T: 설정함  
F: 설정안함

 |
| notification\_time\_day | 

알람시기 선택

3: 3일 전 발송  
7: 7일 전 발송  
15: 15일 전 발송  
30: 1개월 전 발송

 |

### Retrieve an automatic points expiration [](#retrieve-an-automatic-points-expiration)cafe24

GET /api/v2/admin/points/autoexpiration

###### GET

쇼핑몰의 적립금 자동만료 설정을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **적립금 읽기권한 (mall.read\_mileage)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve an automatic points expiration

*   [Retrieve an automatic points expiration](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create an automatic points expiration [](#create-an-automatic-points-expiration)cafe24

POST /api/v2/admin/points/autoexpiration

###### POST

쇼핑몰의 포인트 자동만료 설정을 등록할 수 있습니다.  
적립금의 최초 소멸 시행일과 소멸 실행 주기 등을 설정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **적립금 쓰기권한 (mall.write\_mileage)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **expiration\_date**  
**Required**  

_날짜_

 | 

최초 소멸 시행일

 |
| **interval\_month**  
**Required** | 

소멸 실행 주기

1: 1개월  
3: 3개월  
6: 6개월  
12: 1년

 |
| **target\_period\_month**  
**Required** | 

소멸 대상 적립금

6: 소멸일 기준 6개월 이전 적립금  
12: 소멸일 기준 1년 이전 적립금  
18: 소멸일 기준 1년 6개월 이전 적립금  
24: 소멸일 기준 2년 이전 적립금  
30: 소멸일 기준 2년 6개월 이전 적립금  
36: 소멸일 기준 3년 이전 적립금

 |
| group\_no | 

소멸 대상 회원등급

0: 전체 회원

DEFAULT 0

 |
| **standard\_point**  
**Required**  

_최소값: \[1\]_

 | 

소멸 대상 기준 금액

소멸할 적립금의 최소 기준 금액 입력  
예) 100 기재 시, 100원 이상 적립금 보유 회원만 소멸 대상

 |
| send\_email | 

이메일 발송

T: 설정함  
F: 설정안함

DEFAULT F

 |
| send\_sms | 

SMS 발송

T: 설정함  
F: 설정안함

DEFAULT F

 |
| notification\_time\_day | 

알람시기 선택

3: 3일 전 발송  
7: 7일 전 발송  
15: 15일 전 발송  
30: 1개월 전 발송

 |

Create an automatic points expiration

*   [Create an automatic points expiration](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete an automatic points expiration [](#delete-an-automatic-points-expiration)cafe24

DELETE /api/v2/admin/points/autoexpiration

###### DELETE

쇼핑몰의 포인트 자동만료 설정을 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **적립금 쓰기권한 (mall.write\_mileage)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Delete an automatic points expiration

*   [Delete an automatic points expiration](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Points report

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Points%20report.png)  
  
적립금 통계(Points report)는 지정한 기간동안의 가용적립금의 증감 내역, 미가용 적립금의 총액 등 적립금과 관련된 통계를 조회할 수 있는 리소스입니다.

> Endpoints

```
GET /api/v2/admin/points/report
```

#### \[더보기 상세 내용\]

### Points report property list[](#points-report-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| available\_points\_increase | 

가용 적립금 증가

 |
| available\_points\_decrease | 

가용 적립금 차감

 |
| available\_points\_total | 

가용 적립금 전체

 |
| unavailable\_points | 

미가용 적립금

 |
| unavailable\_coupon\_points | 

미가용 회원 쿠폰 적립금

 |

### Retrieve a points report by date range [](#retrieve-a-points-report-by-date-range)cafe24

GET /api/v2/admin/points/report

###### GET

특정 기간 동안의 적립금의 증감에 관한 통계를 조회할 수 있습니다.  
가용 적립금의 증가, 차감, 전체를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **적립금 읽기권한 (mall.read\_mileage)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

DEFAULT 1

 |
| member\_id  

_최대글자수 : \[20자\]_

 | 

회원아이디

 |
| email  

_이메일_

 | 

이메일

 |
| group\_no | 

회원등급번호

 |
| **start\_date**  
**Required**  

_날짜_

 | 

검색 시작일

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

 |

Retrieve a points report by date range

*   [Retrieve a points report by date range](#none)
*   [Retrieve report with fields parameter](#none)
*   [Retrieve a specific report with member\_id parameter](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Notification

## Automails

자동 알림 메일 관리'에서 메일 항목별 고객, 운영자, 공급사 설정 값을 관리할 수 있습니다. SNS, SMS 전송이 불가한 해외 고객을 관리할 수 있음.

> Endpoints

```
GET /api/v2/admin/automails
PUT /api/v2/admin/automails
```

#### \[더보기 상세 내용\]

### Automails property list[](#automails-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| type | 

메일 항목

[automails\_typecode](https://appservice-guide.s3.ap-northeast-2.amazonaws.com/resource/ko/automails_typecode.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| use\_customer | 

고객

 |
| use\_admin | 

운영자

 |
| use\_supplier | 

공급사

 |

### Retrieve automated email settings [](#retrieve-automated-email-settings)cafe24 youtube

GET /api/v2/admin/automails

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **알림 읽기권한 (mall.read\_notification)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |

Retrieve automated email settings

*   [Retrieve automated email settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update automated email settings [](#update-automated-email-settings)cafe24 youtube

PUT /api/v2/admin/automails

###### PUT

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **알림 쓰기권한 (mall.write\_notification)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **100** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **type**  
**Required** | 

메일 항목

[automails\_typecode](https://appservice-guide.s3.ap-northeast-2.amazonaws.com/resource/ko/automails_typecode.xlsx) ![](https://d2wxkjpieznxai.cloudfront.net/resource/ko/excel_icon.png)

 |
| use\_customer | 

고객

T : 사용함  
F : 사용안함

 |
| use\_admin | 

운영자

T : 사용함  
F : 사용안함

 |
| use\_supplier | 

공급사

T : 사용함  
F : 사용안함

 |

Update automated email settings

*   [Update automated email settings](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Customers invitation

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Customers%20invitation.png)  
  
회원 초대(invitation)는 계정을 활성화하기 위해 SMS, 이메일 등으로 초대 메시지를 발송하는 기능입니다.  
기존에 가입되어 있는 아이디가 있어야만 초대가 가능합니다.

> Endpoints

```
POST /api/v2/admin/customers/{member_id}/invitation
```

#### \[더보기 상세 내용\]

### Customers invitation property list[](#customers__invitation-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

 |
| member\_id  

_최대글자수 : \[16자\]_

 | 

회원아이디

 |

### Send an invitation to activate account [](#send-an-invitation-to-activate-account)cafe24

POST /api/v2/admin/customers/{member\_id}/invitation

###### POST

SMS, 이메일 등으로 고객의 계정을 활성화하기 위한 초대 메시지를 발송합니다.  
회원아이디, 계정 활성화 초대 수단을 필수로 입력합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **알림 쓰기권한 (mall.write\_notification)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **member\_id**  
**Required**  

_최대글자수 : \[16자\]_

 | 

회원아이디

 |
| **invitation\_type**  
**Required** | 

계정 활성화 초대 수단

 |

Send an invitation to activate account

*   [Send an invitation to activate account](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Recipientgroups

발송 그룹(Recipientgroups)은 대량 메일 발송 그룹을 관리하는 기능입니다.  
발송 그룹의 조회, 추가, 수정, 삭제가 가능합니다.

> Endpoints

```
GET /api/v2/admin/recipientgroups
GET /api/v2/admin/recipientgroups/{group_no}
POST /api/v2/admin/recipientgroups
PUT /api/v2/admin/recipientgroups/{group_no}
DELETE /api/v2/admin/recipientgroups/{group_no}
```

#### \[더보기 상세 내용\]

### Recipientgroups property list[](#recipientgroups-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| group\_no | 

발송그룹 번호

 |
| group\_name  

_최대글자수 : \[40자\]_

 | 

발송그룹명

 |
| group\_description  

_최대글자수 : \[255자\]_

 | 

발송그룹 설명

 |
| created\_date | 

등록일

 |
| group\_member\_count | 

발송그룹 회원 수

 |
| news\_mail | 

뉴스메일 수신여부

T : 수신허용  
F : 수신안함  
D : 절대수신안함

 |
| sms | 

SMS 수신여부

T : 수신  
F : 수신안함

 |
| member\_group\_no | 

회원등급번호

 |
| member\_class | 

회원구분

p : 개인  
c : 사업자  
f : 외국인

 |
| member\_type | 

회원타입

vip : 특별관리회원  
poor : 불량회원

 |
| join\_path | 

가입경로

P : PC  
M : 모바일

 |
| inflow\_path | 

유입경로

 |
| inflow\_path\_detail | 

유입경로 상세정보

 |
| date\_type | 

검색날짜 유형

join : 회원가입일  
birthday : 생일  
wedding : 결혼기념일  
partner : 배우자생일

 |
| start\_date  

_날짜_

 | 

검색 시작일

 |
| end\_date  

_날짜_

 | 

검색 종료일

 |
| solar\_calendar | 

양력여부

T : 양력  
F : 음력

 |
| age\_min | 

나이 검색 최소값

 |
| age\_max | 

나이 검색 최대값

 |
| gender | 

성별

M : 남자  
F : 여자

 |
| available\_points\_min | 

적립금 검색 최소값

 |
| available\_points\_max | 

적립금 검색 최대값

 |
| use\_mobile\_app | 

모바일앱 사용여부

T : 사용  
F : 사용안함

 |
| plusapp\_member\_join | 

플러스앱 경로 가입회원 여부

T : 사용함  
F : 사용안함

 |

### Retrieve distribution group list [](#retrieve-distribution-group-list)cafe24

GET /api/v2/admin/recipientgroups

###### GET

대량 메일 발송 그룹의 목록을 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **알림 읽기권한 (mall.read\_notification)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |
| offset  

_최대값: \[10000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |

Retrieve distribution group list

*   [Retrieve distribution group list](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve distribution group details [](#retrieve-distribution-group-details)cafe24

GET /api/v2/admin/recipientgroups/{group\_no}

###### GET

특정 대량 메일 발송 그룹의 상세 정보를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **알림 읽기권한 (mall.read\_notification)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **group\_no**  
**Required**  

_최소값: \[1\]_

 | 

발송그룹 번호

 |

Retrieve distribution group details

*   [Retrieve distribution group details](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Create a distribution group [](#create-a-distribution-group)cafe24

POST /api/v2/admin/recipientgroups

###### POST

대량 메일 발송 그룹을 생성할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **알림 쓰기권한 (mall.write\_notification)** |
| 호출건수 제한 | **30** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **group\_name**  
**Required**  

_최대글자수 : \[40자\]_

 | 

발송그룹명

 |
| group\_description  

_최대글자수 : \[255자\]_

 | 

발송그룹 설명

 |
| news\_mail | 

뉴스메일 수신여부

T : 수신허용  
F : 수신안함  
D : 절대수신안함

 |
| sms | 

SMS 수신여부

T : 수신  
F : 수신안함

 |
| member\_group\_no  

_최소값: \[1\]_

 | 

회원등급번호

 |
| member\_class | 

회원구분

**EC 일본, 베트남 버전에서는 사용할 수 없음.**

p : 개인  
c : 사업자  
f : 외국인

 |
| member\_type | 

회원타입

vip : 특별관리회원  
poor : 불량회원

 |
| join\_path | 

가입경로

P : PC  
M : 모바일

 |
| inflow\_path | 

유입경로

 |
| inflow\_path\_detail | 

유입경로 상세정보

 |
| date\_type | 

검색날짜 유형

join : 회원가입일  
birthday : 생일  
wedding : 결혼기념일  
partner : 배우자생일

 |
| start\_date | 

검색 시작일

 |
| end\_date | 

검색 종료일

 |
| solar\_calendar | 

양력여부

T : 양력  
F : 음력

 |
| age\_min  

_최소: \[1\]~최대: \[99\]_

 | 

나이 검색 최소값

 |
| age\_max  

_최소: \[1\]~최대: \[99\]_

 | 

나이 검색 최대값

 |
| gender | 

성별

M : 남자  
F : 여자

 |
| available\_points\_min  

_최소: \[0\]~최대: \[999999999\]_

 | 

적립금 검색 최소값

 |
| available\_points\_max  

_최소: \[0\]~최대: \[999999999\]_

 | 

적립금 검색 최대값

 |
| use\_mobile\_app | 

모바일앱 사용여부

T : 사용  
F : 사용안함

 |
| plusapp\_member\_join | 

플러스앱 경로 가입회원 여부

T : 사용함  
F : 사용안함

 |

Create a distribution group

*   [Create a distribution group](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Edit distribution group [](#edit-distribution-group)cafe24

PUT /api/v2/admin/recipientgroups/{group\_no}

###### PUT

특정 대량 메일 발송 그룹의 정보를 수정할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **알림 쓰기권한 (mall.write\_notification)** |
| 호출건수 제한 | **30** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **group\_no**  
**Required**  

_최소값: \[1\]_

 | 

발송그룹 번호

 |
| **group\_name**  
**Required**  

_최대글자수 : \[40자\]_

 | 

발송그룹명

 |
| group\_description  

_최대글자수 : \[255자\]_

 | 

발송그룹 설명

 |
| news\_mail | 

뉴스메일 수신여부

T : 수신허용  
F : 수신안함  
D : 절대수신안함

 |
| sms | 

SMS 수신여부

T : 수신  
F : 수신안함

 |
| member\_group\_no  

_최소값: \[1\]_

 | 

회원등급번호

 |
| member\_class | 

회원구분

**EC 일본, 베트남 버전에서는 사용할 수 없음.**

p : 개인  
c : 사업자  
f : 외국인

 |
| member\_type | 

회원타입

vip : 특별관리회원  
poor : 불량회원

 |
| join\_path | 

가입경로

P : PC  
M : 모바일

 |
| inflow\_path | 

유입경로

 |
| inflow\_path\_detail | 

유입경로 상세정보

 |
| date\_type | 

검색날짜 유형

join : 회원가입일  
birthday : 생일  
wedding : 결혼기념일  
partner : 배우자생일

 |
| start\_date | 

검색 시작일

 |
| end\_date | 

검색 종료일

 |
| solar\_calendar | 

양력여부

T : 양력  
F : 음력

 |
| age\_min  

_최소: \[1\]~최대: \[99\]_

 | 

나이 검색 최소값

 |
| age\_max  

_최소: \[1\]~최대: \[99\]_

 | 

나이 검색 최대값

 |
| gender | 

성별

M : 남자  
F : 여자

 |
| available\_points\_min  

_최소: \[0\]~최대: \[999999999\]_

 | 

적립금 검색 최소값

 |
| available\_points\_max  

_최소: \[0\]~최대: \[999999999\]_

 | 

적립금 검색 최대값

 |
| use\_mobile\_app | 

모바일앱 사용여부

T : 사용  
F : 사용안함

 |
| plusapp\_member\_join | 

플러스앱 경로 가입회원 여부

T : 사용함  
F : 사용안함

 |

Edit distribution group

*   [Edit distribution group](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Delete distribution group [](#delete-distribution-group)cafe24

DELETE /api/v2/admin/recipientgroups/{group\_no}

###### DELETE

특정 대량 메일 발송 그룹을 삭제할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **알림 쓰기권한 (mall.write\_notification)** |
| 호출건수 제한 | **30** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **group\_no**  
**Required**  

_최소값: \[1\]_

 | 

발송그룹 번호

 |

Delete distribution group

*   [Delete distribution group](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Sms

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Sms.png)  
  
SMS를 통해 회원 혹은 특정 휴대전화 번호로 SMS메시지를 발송할 수 있습니다.  
SMS API를 사용하기 위해서는 먼저 쇼핑몰에서 SMS 발송 서비스를 사용하고 있는지 확인이 필요합니다.

> Endpoints

```
POST /api/v2/admin/sms
```

#### \[더보기 상세 내용\]

### Sms property list[](#sms-property-list)

| **Attribute** | **Description** |
| --- | --- |
| queue\_code | 
큐 코드

 |

### Send a SMS [](#send-a-sms)cafe24 youtube

POST /api/v2/admin/sms

###### POST

SMS를 발송할 수 있습니다.  
\*\*해당 API는 한국어 쇼핑몰에서만 사용 가능합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **알림 쓰기권한 (mall.write\_notification)** |
| 호출건수 제한 | **1** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **sender\_no**  
**Required** | 

발신자 아이디

발신자의 고유한 일련번호

 |
| **content**  
**Required** | 

메시지

 |
| recipients  

_배열 최대사이즈: \[100\]_

 | 

수신자 전화번호

 |
| member\_id  

_배열 최대사이즈: \[100\]_

 | 

회원아이디

 |
| group\_no | 

회원등급번호

0 : 전체 등급

 |
| exclude\_unsubscriber | 

수신거부자 제외 발송 여부

수신거부자를 제외하고 발송할지 여부를 설정할 수 있음.

T : 제외  
F : 포함

DEFAULT T

 |
| type | 

발송 타입

SMS 의 발송 타입.  
SMS 는 1건당 최대 90byte 까지 입력 가능하고 90byte 초과 시 여러 개로 나눠서 발송한다.  
LMS 는 1건당 최대 2000byte 까지 입력 가능하다.

SMS : 단문  
LMS : 장문

DEFAULT SMS

 |
| title | 

제목

 |

Send a SMS

*   [Send a SMS](#none)
*   [Send a SMS to a customer by using member\_id field](#none)
*   [Send a SMS to a customer by using recipients field](#none)
*   [Try sending a SMS to a customer without using sender\_no field](#none)
*   [Try sending a SMS to a customer without using content field](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Sms balance

문자발송건수는 장문, 단문발송건수에 대한 정보를 제공합니다.

> Endpoints

```
GET /api/v2/admin/sms/balance
```

#### \[더보기 상세 내용\]

### Sms balance property list[](#sms-balance-property-list)

| **Attribute** | **Description** |
| --- | --- |
| balance | 
SMS 잔여 건수

 |
| sms\_count | 

단문(SMS) 발송 가능 건수

 |
| lms\_count | 

장문(LMS) 발송 가능 건수

 |

### Retrieve the SMS balance [](#retrieve-the-sms-balance)cafe24 youtube

GET /api/v2/admin/sms/balance

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **알림 읽기권한 (mall.read\_notification)** |
| 호출건수 제한 | **40** |

Retrieve the SMS balance

*   [Retrieve the SMS balance](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Sms receivers

수신자 등록 여부에 따라 운영자, 부운영자, 공급사의 알람 메시지 발송 여부를 확인할 수 있습니다.

> Endpoints

```
GET /api/v2/admin/sms/receivers
```

#### \[더보기 상세 내용\]

### Sms receivers property list[](#sms-receivers-property-list)

| **Attribute** | **Description** |
| --- | --- |
| no | 
번호

 |
| recipient\_type | 

수신자 구분

 |
| supplier\_name | 

공급사명

 |
| supplier\_id | 

공급사 아이디

 |
| user\_name | 

운영자명

 |
| user\_id | 

운영자 아이디

 |
| manager\_name | 

담당자명

 |
| cellphone | 

휴대전화

 |

### Retrieve a SMS recipient [](#retrieve-a-sms-recipient)cafe24

GET /api/v2/admin/sms/receivers

###### GET

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **알림 읽기권한 (mall.read\_notification)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| recipient\_type | 
수신자 구분

ALL:전체  
S:공급사  
A:운영자

 |
| supplier\_name | 

공급사명

 |
| supplier\_id | 

공급사 아이디

 |
| user\_name | 

운영자명

 |
| user\_id | 

운영자 아이디

 |
| manager\_name | 

담당자명

 |
| cellphone  

_모바일_

 | 

휴대전화

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve a SMS recipient

*   [Retrieve a SMS recipient](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Sms senders

![](https://d2wxkjpieznxai.cloudfront.net/resource/diagram/Sms%20senders.png)  
  
SMS 발신자(Sms senders)는 SMS를 발송할 발신번호를 나타냅니다. SMS 발신자의 발신번호는 반드시 본인인증이 되어있어야 합니다.  
SMS 발신자는 SMS에 속해있는 하위 리소스입니다.

> Endpoints

```
GET /api/v2/admin/sms/senders
```

#### \[더보기 상세 내용\]

### Sms senders property list[](#sms-senders-property-list)

| **Attribute** | **Description** |
| --- | --- |
| sender\_no | 
발신자 아이디

발신자의 고유한 일련번호

 |
| sender | 

발신자 번호

발신자의 전화번호

 |
| auth\_status | 

인증 상태

발신자의 전화번호의 인증 상태.  
인증완료 상태인 발신자로만 SMS 를 발송할 수 있다.

00 : 삭제  
10 : 등록  
20 : 심사중  
30 : 인증완료  
40 : 반려

 |
| memo | 

메모

request\_reason: 요청 사유  
reject\_reason: 반려 사유

 |

### Retrieve a list of SMS senders [](#retrieve-a-list-of-sms-senders)cafe24 youtube

GET /api/v2/admin/sms/senders

###### GET

쇼핑몰에 등록된 SMS 발신자를 목록으로 조회할 수 있습니다.  
해당 API는 한국어 쇼핑몰에서만 사용 가능합니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **알림 읽기권한 (mall.read\_notification)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| offset  
_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

조회하고자 하는 최대 건수를 지정할 수 있음.  
예) 10 입력시 10건만 표시함.

DEFAULT 10

 |

Retrieve a list of SMS senders

*   [Retrieve a list of SMS senders](#none)
*   [Retrieve senders with fields parameter](#none)
*   [Retrieve senders using paging](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Translation

## Translations categories

상품 분류 번역 정보(Translations categories)는, 상품 분류의 번역 정보를 조회하거나 수정할 수 있는 기능입니다.

> Endpoints

```
GET /api/v2/admin/translations/categories
PUT /api/v2/admin/translations/categories/{category_no}
```

#### \[더보기 상세 내용\]

### Translations categories property list[](#translations-categories-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| category\_no | 

분류 번호

 |
| translations | 

번역 정보

 |

### Retrieve a list of product category translations [](#retrieve-a-list-of-product-category-translations)cafe24

GET /api/v2/admin/translations/categories

###### GET

상품 분류의 번역 정보를 조회할 수 있습니다.  
언어 코드, 메타태그 등의 정보를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **번역 읽기권한 (mall.read\_translation)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| category\_no | 

분류 번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| language\_code | 

언어 코드

번역 정보의 언어 코드에 해당되는 번역 정보를 검색  
언어별로 번역된 정보에서 검색하고자 하는 언어를 선택하면, 해당 언어에 대한 번역 내용을 확인할 수 있습니다.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve a list of product category translations

*   [Retrieve a list of product category translations](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update product category translation [](#update-product-category-translation)cafe24

PUT /api/v2/admin/translations/categories/{category\_no}

###### PUT

상품 분류의 번역 정보를 수정할 수 있습니다.  
번역정보 수정시, 언어 코드는 필수 입력 항목입니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **번역 쓰기권한 (mall.write\_translation)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **category\_no**  
**Required** | 

분류 번호

 |
| translations | 

번역 정보

 |
| 

translations 하위 요소 보기

**language\_code**  
**Required**  
언어 코드

**category\_name**  
분류명

**seo** _Array_

seo 하위 요소 보기

**meta\_title**  
브라우저 타이틀

**meta\_author**  
메타태그1 : Author

**meta\_description**  
메타태그2 : Description

**meta\_keywords**  
메타태그3 : Keywords













 |

Update product category translation

*   [Update product category translation](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Translations products

상품 번역 정보(Translations products)는, 상품의 번역 정보를 조회하거나 수정할 수 있는 기능입니다.

> Endpoints

```
GET /api/v2/admin/translations/products
PUT /api/v2/admin/translations/products/{product_no}
```

#### \[더보기 상세 내용\]

### Translations products property list[](#translations-products-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| product\_no | 

상품번호

 |
| product\_name  

_최대글자수 : \[250자\]_

 | 

상품명

 |
| translations | 

번역 정보

 |

### Retrieve a list of product translations [](#retrieve-a-list-of-product-translations)cafe24 youtube

GET /api/v2/admin/translations/products

###### GET

상품의 번역 정보를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **번역 읽기권한 (mall.read\_translation)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| product\_no | 

상품번호

,(콤마)로 여러 건을 검색할 수 있다.

 |
| product\_name | 

상품명

상품의 상품명에 해당되는 번역 정보를 검색

,(콤마)로 여러 건을 검색할 수 있다.

 |
| language\_code | 

언어 코드

번역 정보의 언어 코드에 해당되는 번역 정보를 검색  
언어별로 번역된 정보에서 검색하고자 하는 언어를 선택하면, 해당 언어에 대한 번역 내용을 확인할 수 있습니다.

,(콤마)로 여러 건을 검색할 수 있다.

 |
| offset  

_최대값: \[8000\]_

 | 

조회결과 시작위치

DEFAULT 0

 |
| limit  

_최소: \[1\]~최대: \[100\]_

 | 

조회결과 최대건수

DEFAULT 10

 |

Retrieve a list of product translations

*   [Retrieve a list of product translations](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update product translation [](#update-product-translation)cafe24 youtube

PUT /api/v2/admin/translations/products/{product\_no}

###### PUT

상품의 번역 정보를 수정할 수 있습니다.  
번역정보 수정시, 언어 코드는 필수 입력 항목입니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **번역 쓰기권한 (mall.write\_translation)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **product\_no**  
**Required** | 

상품번호

 |
| translations | 

번역 정보

 |
| 

translations 하위 요소 보기

**language\_code**  
**Required**  
언어 코드

**product\_name**  
상품명

**product\_tag**  
상품 검색어

**payment\_info**  
상품결제안내

**shipping\_info**  
상품배송안내

**exchange\_info**  
교환/반품안내

**service\_info**  
서비스문의/안내

**summary\_description**  
상품요약설명

**simple\_description**  
상품 간략 설명

**description**  
상품상세설명

**mobile\_description**  
모바일 상품 상세설명

**product\_material**  
상품소재

**seo** _Array_

seo 하위 요소 보기

**meta\_title**  
브라우저 타이틀

**meta\_author**  
메타태그1 : Author

**meta\_description**  
메타태그2 : Description

**meta\_keywords**  
메타태그3 : Keywords

**meta\_alt**  
상품 이미지 Alt 텍스트

**options** _Array_

options 하위 요소 보기

**name**  
옵션명

**value**  
옵션값













 |

Update product translation

*   [Update product translation](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Translations store

상점 번역 정보(Translations store)는, 상점의 번역 정보를 조회하거나 수정할 수 있는 기능입니다.

> Endpoints

```
GET /api/v2/admin/translations/store
PUT /api/v2/admin/translations/store
```

#### \[더보기 상세 내용\]

### Translations store property list[](#translations-store-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| translations | 

번역 정보

 |

### Retrieve a list of store translations [](#retrieve-a-list-of-store-translations)cafe24

GET /api/v2/admin/translations/store

###### GET

상점의 번역 정보를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **번역 읽기권한 (mall.read\_translation)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| language\_code | 

언어 코드

언어별로 번역된 정보에서 검색하고자 하는 언어를 선택하면, 해당 언어에 대한 번역 내용을 확인할 수 있습니다.

,(콤마)로 여러 건을 검색할 수 있다.

 |

Retrieve a list of store translations

*   [Retrieve a list of store translations](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update the translations of a store [](#update-the-translations-of-a-store)cafe24

PUT /api/v2/admin/translations/store

###### PUT

상점의 번역 정보를 수정할 수 있습니다.  
번역정보 수정시, 언어 코드는 필수 입력 항목입니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **번역 쓰기권한 (mall.write\_translation)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| translations | 

번역 정보

 |
| 

translations 하위 요소 보기

**language\_code**  
**Required**  
언어 코드

**shop\_name**  
쇼핑몰명

**company\_name**  
상호명

**company\_registration\_no**  
사업자등록번호

**president\_name**  
대표자명

**phone**  
전화번호

**email**  
이메일

**fax**  
팩스번호

**zipcode**  
우편번호

**address1**  
기본 주소

**address2**  
상세 주소

**customer\_service\_phone**  
고객센터 상담/주문 전화

**customer\_service\_hours**  
고객센터 운영시간

**privacy\_officer\_name**  
개인정보보호 책임자명

**privacy\_officer\_email**  
개인정보보호 책임자 이메일







 |

Update the translations of a store

*   [Update the translations of a store](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

## Translations themes

테마 번역 정보(Translations themes)는, 다국어 코드화된 디자인 스킨에 탑재된 번역 정보를 조회하거나 수정할 수 있는 기능입니다.

> Endpoints

```
GET /api/v2/admin/translations/themes
GET /api/v2/admin/translations/themes/{skin_no}
PUT /api/v2/admin/translations/themes/{skin_no}
```

#### \[더보기 상세 내용\]

### Translations themes property list[](#translations-themes-property-list)

| **Attribute** | **Description** |
| --- | --- |
| skin\_no | 
디자인 번호

 |
| translations | 

번역 정보

 |
| skin\_code | 

디자인 코드

 |
| skin\_translation | 

디자인 번역 정보

 |

### Retrieve a list of theme translations [](#retrieve-a-list-of-theme-translations)cafe24

GET /api/v2/admin/translations/themes

###### GET

디자인의 디자인 번역 정보를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **번역 읽기권한 (mall.read\_translation)** |
| 호출건수 제한 | **40** |

Retrieve a list of theme translations

*   [Retrieve a list of theme translations](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Retrieve a theme translation [](#retrieve-a-theme-translation)cafe24

GET /api/v2/admin/translations/themes/{skin\_no}

###### GET

특정 디자인의 디자인 번역 정보를 조회할 수 있습니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **번역 읽기권한 (mall.read\_translation)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **skin\_no**  
**Required** | 
디자인 번호

 |
| **language\_code**  
**Required** | 

언어 코드

 |

Retrieve a theme translation

*   [Retrieve a theme translation](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

### Update a theme translation [](#update-a-theme-translation)cafe24

PUT /api/v2/admin/translations/themes/{skin\_no}

###### PUT

특정 디자인의 디자인 번역 정보를 수정할 수 있습니다.  
디자인 번역정보 수정시, 언어 코드와 소스 코드는 필수 입력 항목입니다.

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **번역 쓰기권한 (mall.write\_translation)** |
| 호출건수 제한 | **40** |
| 1회당 요청건수 제한 | **1** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| **skin\_no**  
**Required** | 
디자인 번호

 |
| skin\_translation | 

디자인 번역 정보

 |
| 

skin\_translation 하위 요소 보기

**language\_code**  
**Required**  
언어 코드

**source**  
**Required**  
소스 코드







 |

Update a theme translation

*   [Update a theme translation](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

# Analytics

## Financials dailyvisits

일별 방문수(Financials dailyvisits)는 검색 기간 내의 일별 방문수를 제공합니다.

> Endpoints

```
GET /api/v2/admin/financials/dailyvisits
```

#### \[더보기 상세 내용\]

### Financials dailyvisits property list[](#financials-dailyvisits-property-list)

| **Attribute** | **Description** |
| --- | --- |
| shop\_no | 
멀티쇼핑몰 번호

 |
| date | 

날짜

 |
| visitors\_count | 

방문수

 |

### Retrieve a count of dailyvisits [](#retrieve-a-count-of-dailyvisits)cafe24

GET /api/v2/admin/financials/dailyvisits

###### GET

검색 기간 내의 일별 방문수를 조회합니다.

`해당 API는 특정 클라이언트만 사용할 수 있는 API입니다. 사용하시려면 카페24 개발자센터로 문의해주세요.`

#### 기본스펙

| **Property** | **Description** |
| --- | --- |
| SCOPE | **접속통계 읽기권한 (mall.read\_analytics)** |
| 호출건수 제한 | **40** |

#### 요청사양

| **Parameter** | **Description** |
| --- | --- |
| shop\_no  
_최소값: \[1\]_

 | 

멀티쇼핑몰 번호

DEFAULT 1

 |
| **start\_date**  
**Required**  

_날짜_

 | 

검색 시작일

 |
| **end\_date**  
**Required**  

_날짜_

 | 

검색 종료일

 |

Retrieve a count of dailyvisits

*   [Retrieve a count of dailyvisits](#none)

> Request cURL Java Python Node.js PHP Go [Copy](#none)

> Response [Copy](#none)

[Top](#)