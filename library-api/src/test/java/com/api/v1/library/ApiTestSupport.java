package com.api.v1.library;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Small helpers shared by the API tests: sign in, call with a token, read the JSON body. */
abstract class ApiTestSupport {

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JsonMapper json;

    protected String login(String id, String password) throws Exception {
        return login(id, password, null);
    }

    /** Signs in (optionally registering a push device token) and returns the JWT. */
    protected String login(String id, String password, String deviceToken) throws Exception {
        String device = deviceToken == null ? "" : ",\"deviceToken\":\"" + deviceToken + "\",\"platform\":\"ANDROID\"";
        JsonNode res = body(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"" + id + "\",\"password\":\"" + password + "\"" + device + "}"))
                .andExpect(status().isOk()));
        return res.at("/payload/token").asString();
    }

    protected ResultActions call(MockHttpServletRequestBuilder builder, String token, String content) throws Exception {
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (content != null) builder.contentType(MediaType.APPLICATION_JSON).content(content);
        return mvc.perform(builder);
    }

    protected JsonNode body(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }

    /** The "payload" of a SuccessResponse / PaginationResponse. */
    protected JsonNode payload(ResultActions result) throws Exception {
        return body(result).get("payload");
    }
}
