import { ChatOpenAI } from "langchain/chat_models/openai";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { Configuration } from "openai";
import { OpenAIApi } from "openai";
import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { response } from "express";

const openAIApiKey = "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";

const params = {
  verbose: true,
  temperature: 0,
  openAIApiKey,
  modelName: process.env.OPENAI_MODEL ?? "gpt-3.5-turbo",
  maxTokens: 100,
  maxRetries: 5,
};

export class Model {
  public chain: ConversationChain;
  public openai: OpenAIApi;
  public pineconeClient: PineconeClient;
  public pineconeIndex: any;
  public vectorStore: any;

  constructor() {
    const configuration = new Configuration({
      apiKey: openAIApiKey,
    });

    this.openai = new OpenAIApi(configuration);
    const model = new ChatOpenAI(params, configuration);

    // Initialize Pinecone Client
    this.pineconeClient = new PineconeClient();

    const chatPrompt = ChatPromptTemplate.fromPromptMessages([
      SystemMessagePromptTemplate.fromTemplate(
        "You are a Tinnitus expert and User is someone with tinnitus who is coming to you for help. Research the documents thoroughly to frame your response. When user asks you questions you will give them very short and concise answers and tell them what to do as though they were having a one on one private conversation. You can also ask them followup questions on top of your answers in order to garner more information about my situation"
      ),
      new MessagesPlaceholder("history"),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);

    this.chain = new ConversationChain({
      memory: new BufferMemory({ returnMessages: true }),
      prompt: chatPrompt,
      llm: model,
    });
  }

  public async init() {
    console.log("Initializing Pinecone client...");
    await this.pineconeClient.init({
      apiKey: "173b3325-ad25-4535-bbf1-96c11aa8f0ac",
      environment: "us-west1-gcp-free",
    });
    console.log("Pinecone client initialized");
    this.pineconeIndex = this.pineconeClient.Index("myproject");

    console.log("Initializing vector store...");
    this.vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings(),
      { pineconeIndex: this.pineconeIndex }
    );
    console.log("Vector store initialized");
  }

  public async call(input: string) {
    console.log("Converting input to vector...");
    const inputVector = await this.vectorStore.embeddings.embed(input);
    console.log("Input vector:", inputVector);

    console.log("Searching for most similar vectors in database...");
    const results = await this.vectorStore.search(inputVector, { k: 1 });
    console.log("Search results:", results);

    const mostSimilarId = results[0].id;
    console.log("Most similar ID:", mostSimilarId);

    console.log("Retrieving data from Pinecone database...");
    const mostSimilarData = await this.pineconeIndex.fetch(mostSimilarId);
    console.log("Most similar data:", mostSimilarData);

    console.log("Generating response using data from Pinecone database...");
    const response= await this.chain.call({ input: mostSimilarData });
    console.log("Generated response:", response.output);

    return response.output;
  }
}
