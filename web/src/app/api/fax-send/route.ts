import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!url || !key) return null;
    return createClient(url, key);
}

interface FaxSendRequest {
    po_id: string;
    vendor_prefix: string;
    html_content: string;
    fax_number?: string;
    provider?: 'mock' | 'twilio' | 'sendpulse' | 'custom';
}

interface FaxSendResult {
    success: boolean;
    provider: string;
    provider_message_id?: string;
    payload_url?: string;
    error?: string;
    request: object;
    response: object;
}

/**
 * POST /api/fax/send
 * Send fax (or generate PDF for mock mode) for factory purchase order
 */
export async function POST(request: Request) {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
        return NextResponse.json(
            { error: "Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)" },
            { status: 500 }
        );
    }

    try {
        const body: FaxSendRequest = await request.json();
        const { po_id, vendor_prefix, html_content, fax_number, provider = 'mock' } = body;

        if (!po_id || !html_content) {
            return NextResponse.json(
                { error: "Missing required fields: po_id, html_content" },
                { status: 400 }
            );
        }

        let result: FaxSendResult;

        // Route to appropriate provider
        switch (provider) {
            case 'mock':
                result = await sendMockFax(supabase, po_id, vendor_prefix, html_content);
                break;
            case 'twilio':
                result = await sendTwilioFax(supabase, po_id, fax_number, html_content);
                break;
            case 'sendpulse':
                result = await sendSendpulseFax(supabase, po_id, fax_number, html_content);
                break;
            case 'custom':
                result = await sendCustomFax(supabase, po_id, fax_number, html_content);
                break;
            default:
                result = await sendMockFax(supabase, po_id, vendor_prefix, html_content);
        }

        // Call RPC to mark PO as sent
        if (result.success) {
            const { data: rpcResult, error: rpcError } = await supabase.rpc(
                'cms_fn_factory_po_mark_sent',
                {
                    p_po_id: po_id,
                    p_fax_result: {
                        success: true,
                        provider: result.provider,
                        provider_message_id: result.provider_message_id,
                        payload_url: result.payload_url,
                        request: result.request,
                        response: result.response
                    },
                    p_actor_person_id: null
                }
            );

            if (rpcError) {
                console.error('RPC error marking PO as sent:', rpcError);
                // Still return success but note the RPC error
                return NextResponse.json({
                    success: true,
                    po_id,
                    fax_result: result,
                    rpc_error: rpcError.message,
                    warning: "Fax sent but failed to update PO status"
                });
            }

            return NextResponse.json({
                success: true,
                po_id,
                fax_result: result,
                rpc_result: rpcResult
            });
        } else {
            // Log failed fax attempt
            await supabase.from('cms_fax_log').insert({
                po_id,
                provider: result.provider,
                request_meta: result.request,
                response_meta: result.response,
                success: false,
                error_message: result.error
            });

            return NextResponse.json({
                success: false,
                po_id,
                fax_result: result,
                error: result.error
            }, { status: 502 });
        }

    } catch (error) {
        console.error('Fax send error:', error);
        return NextResponse.json(
            { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}

/**
 * Mock fax provider - generates PDF and stores in Supabase Storage
 */
async function sendMockFax(
    supabase: ReturnType<typeof createClient>,
    po_id: string,
    vendor_prefix: string,
    html_content: string
): Promise<FaxSendResult> {
    try {
        // In mock mode, we generate a simple PDF-like representation
        // In production, you'd use Puppeteer/Playwright to generate actual PDF
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `fax-mock-${vendor_prefix}-${timestamp}.html`;
        const storage_path = `factory-pos/${po_id}/${filename}`;

        // Store HTML content (in production, convert to PDF first)
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('factory-orders')
            .upload(storage_path, html_content, {
                contentType: 'text/html',
                upsert: true
            });

        if (uploadError) {
            // Try alternative bucket
            const { error: altError } = await supabase.storage
                .from('receipts')
                .upload(storage_path, html_content, {
                    contentType: 'text/html',
                    upsert: true
                });

            if (altError) {
                throw new Error(`Failed to upload mock fax: ${uploadError.message}`);
            }
        }

        // Get public URL (or signed URL)
        const { data: urlData } = await supabase.storage
            .from(uploadData ? 'factory-orders' : 'receipts')
            .getPublicUrl(storage_path);

        return {
            success: true,
            provider: 'mock',
            provider_message_id: `mock-${Date.now()}`,
            payload_url: urlData?.publicUrl || storage_path,
            request: { po_id, vendor_prefix, content_length: html_content.length },
            response: { uploaded: true, path: storage_path }
        };

    } catch (error) {
        return {
            success: false,
            provider: 'mock',
            error: error instanceof Error ? error.message : 'Mock fax failed',
            request: { po_id, vendor_prefix },
            response: {}
        };
    }
}

/**
 * Twilio Fax provider
 */
async function sendTwilioFax(
    supabase: ReturnType<typeof createClient>,
    po_id: string,
    fax_number: string | undefined,
    html_content: string
): Promise<FaxSendResult> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FAX_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        return {
            success: false,
            provider: 'twilio',
            error: 'Twilio credentials not configured',
            request: { po_id },
            response: {}
        };
    }

    if (!fax_number) {
        return {
            success: false,
            provider: 'twilio',
            error: 'Fax number not provided',
            request: { po_id },
            response: {}
        };
    }

    try {
        // First upload PDF to a publicly accessible URL (Twilio requires media URL)
        const timestamp = new Date().toISOString();
        const filename = `fax-${po_id}.pdf`;
        const storage_path = `twilio-fax/${filename}`;

        // Store the HTML content (in production, convert to PDF)
        const { error: uploadError } = await supabase.storage
            .from('factory-orders')
            .upload(storage_path, html_content, {
                contentType: 'text/html',
                upsert: true
            });

        if (uploadError) {
            throw new Error(`Failed to upload fax media: ${uploadError.message}`);
        }

        const { data: urlData } = await supabase.storage
            .from('factory-orders')
            .createSignedUrl(storage_path, 3600); // 1 hour expiry

        const mediaUrl = urlData?.signedUrl;

        if (!mediaUrl) {
            throw new Error('Failed to generate media URL');
        }

        // Call Twilio API
        const twilioResponse = await fetch(
            `https://fax.twilio.com/v1/Faxes`,
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    'To': fax_number,
                    'From': fromNumber,
                    'MediaUrl': mediaUrl
                })
            }
        );

        const twilioResult = await twilioResponse.json();

        if (!twilioResponse.ok) {
            throw new Error(twilioResult.message || 'Twilio fax request failed');
        }

        return {
            success: true,
            provider: 'twilio',
            provider_message_id: twilioResult.sid,
            payload_url: mediaUrl,
            request: { to: fax_number, from: fromNumber },
            response: twilioResult
        };

    } catch (error) {
        return {
            success: false,
            provider: 'twilio',
            error: error instanceof Error ? error.message : 'Twilio fax failed',
            request: { po_id, to: fax_number },
            response: {}
        };
    }
}

/**
 * SendPulse Fax provider (placeholder)
 */
async function sendSendpulseFax(
    supabase: ReturnType<typeof createClient>,
    po_id: string,
    fax_number: string | undefined,
    html_content: string
): Promise<FaxSendResult> {
    // Placeholder for SendPulse integration
    // Similar pattern to Twilio
    return {
        success: false,
        provider: 'sendpulse',
        error: 'SendPulse integration not yet implemented',
        request: { po_id },
        response: {}
    };
}

/**
 * Custom Fax provider (placeholder for custom integration)
 */
async function sendCustomFax(
    supabase: ReturnType<typeof createClient>,
    po_id: string,
    fax_number: string | undefined,
    html_content: string
): Promise<FaxSendResult> {
    // Placeholder for custom fax provider
    // Use environment variables for configuration
    const customEndpoint = process.env.CUSTOM_FAX_ENDPOINT;
    const customApiKey = process.env.CUSTOM_FAX_API_KEY;

    if (!customEndpoint || !customApiKey) {
        return {
            success: false,
            provider: 'custom',
            error: 'Custom fax provider not configured',
            request: { po_id },
            response: {}
        };
    }

    try {
        // Implement custom provider API call
        // This is a placeholder - implement according to your provider's API
        return {
            success: false,
            provider: 'custom',
            error: 'Custom fax provider not fully implemented',
            request: { po_id, endpoint: customEndpoint },
            response: {}
        };
    } catch (error) {
        return {
            success: false,
            provider: 'custom',
            error: error instanceof Error ? error.message : 'Custom fax failed',
            request: { po_id },
            response: {}
        };
    }
}
