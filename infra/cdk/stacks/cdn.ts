import type { IFunctionUrl,
              IVersion      } from "aws-cdk-lib/aws-lambda"
import type { IBucket       } from "aws-cdk-lib/aws-s3"
import { Construct          } from "constructs"
import { NagSuppressions    } from "cdk-nag"
import * as s3                from "aws-cdk-lib/aws-s3"
import * as cf                from "aws-cdk-lib/aws-cloudfront"
import * as origins           from "aws-cdk-lib/aws-cloudfront-origins"





export interface CdnProps {

    prefix              : string
    logBucket           : s3.IBucket
    production          : boolean
    backendServer       : IFunctionUrl
    staticContent       : IBucket
    basepath            : string
    bodyHasher         ?: IVersion
    firewall           ?: string
    indexFile          ?: string
    geoRestrictions    ?: string[]
}

export class CDN extends Construct {

    #cdn        : cf.IDistribution
    #basepath   : string

    get url() {

        return `https://${this.#cdn.distributionDomainName}${this.#basepath}`
    }

    get cdn() {

        return this.#cdn
    }

    constructor(scope: Construct, id: string, props: CdnProps) {

        super(scope, id)

        const isWorkshop    = this.node.tryGetContext('workshop')
        const cleanBase     = props.basepath.trim().replace(/^\/+/, '')
        const base          = cleanBase ? `/${cleanBase}` : ''
        const indexFile     = props.indexFile || 'index.html'
        const s3Origin      = origins.S3BucketOrigin.withOriginAccessControl(props.staticContent, { originId: 'StaticContent' })
        const lambdaOrigin  = isWorkshop
            ? new origins.FunctionUrlOrigin(props.backendServer, { originId: 'Backend' })
            : origins.FunctionUrlOrigin.withOriginAccessControl(props.backendServer, { originId: 'Backend' })

        const redirector    = new cf.Function(this, 'Redirector', {
            functionName    :`${props.prefix}-home-redirector`,
            runtime         : cf.FunctionRuntime.JS_2_0,
            code            : cf.FunctionCode.fromInline(`function handler(event) {
    var request = event.request;
    var uri = request.uri;

    if (uri === '${base}' || uri === '${base}/') {

        request.uri = '${base}/${indexFile}';
    }

    return request;
}`)
        })

        const route_to_S3: cf.BehaviorOptions = {

            origin                  : s3Origin,
            viewerProtocolPolicy    : cf.ViewerProtocolPolicy.HTTPS_ONLY,
            allowedMethods          : cf.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods           : cf.CachedMethods.CACHE_GET_HEAD,
            cachePolicy             : props.production ? cf.CachePolicy.CACHING_OPTIMIZED : cf.CachePolicy.CACHING_DISABLED,
            originRequestPolicy     : cf.OriginRequestPolicy.CORS_S3_ORIGIN,
            responseHeadersPolicy   : cf.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
            functionAssociations    : []
        }

        const route_to_home: cf.BehaviorOptions = {

            origin                  : s3Origin,
            viewerProtocolPolicy    : cf.ViewerProtocolPolicy.HTTPS_ONLY,
            allowedMethods          : cf.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods           : cf.CachedMethods.CACHE_GET_HEAD,
            cachePolicy             : props.production ? cf.CachePolicy.CACHING_OPTIMIZED : cf.CachePolicy.CACHING_DISABLED,
            originRequestPolicy     : cf.OriginRequestPolicy.CORS_S3_ORIGIN,
            responseHeadersPolicy   : cf.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
            functionAssociations    : [{

                eventType           : cf.FunctionEventType.VIEWER_REQUEST,
                function            : redirector
            }]
        }

        const route_to_Backend: cf.BehaviorOptions = {

            origin                  : lambdaOrigin,
            viewerProtocolPolicy    : cf.ViewerProtocolPolicy.HTTPS_ONLY,
            allowedMethods          : cf.AllowedMethods.ALLOW_ALL,
            cachePolicy             : cf.CachePolicy.CACHING_DISABLED,
            originRequestPolicy     : cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
            functionAssociations    : [],
        }

        this.#cdn = new cf.Distribution(this, 'Distribution', {

            // ↓↓↓↓ at the moment "minimumProtocolVersion setting" doesn't have
            //      effect for "cloudfront.net" default domain.
            //      But if you use your own domain then the minimumProtocolVersion
            //      would work for you, and this is the best practice:
            comment                 :`${props.prefix}-miniapp`,
            minimumProtocolVersion  : cf.SecurityPolicyProtocol.TLS_V1_3_2025,
            geoRestriction          : cf.GeoRestriction.denylist(...(props.geoRestrictions||[])),
            priceClass              : cf.PriceClass.PRICE_CLASS_ALL,
            httpVersion             : cf.HttpVersion.HTTP2_AND_3,
            webAclId                : props.firewall,
            enableLogging           : true,
            logIncludesCookies      : false,
            logBucket               : props.logBucket,
            logFilePrefix           :'web',
            defaultRootObject       : cleanBase ? `${cleanBase}/${indexFile}` : indexFile,
            defaultBehavior         : route_to_S3,
            additionalBehaviors     : {

                [`${base}`]         : route_to_home,
                [`${base}/`]        : route_to_home,
                [`${base}/*`]       : route_to_Backend
            }
        })

        this.#basepath = base

        NagSuppressions.addResourceSuppressions(this, [
            {
                id          : 'AwsSolutions-CFR4',
                reason      : 'Using cloudfront.net domain'
            }
        ], true)
    }
}