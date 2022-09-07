// /*
//  * $Id: rawdeflate.js,v 0.3 2009/03/01 19:05:05 dankogai Exp dankogai $
//  *
//  * Original:
//  *   http://www.onicos.com/staff/iz/amuse/javascript/expert/deflate.txt
//  */

// // if run as a web worker, respond to messages by deflating them
// var deflate = (function () {
//   /* Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
//    * Version: 1.0.1
//    * LastModified: Dec 25 1999
//    */

//   /* Interface:
//    * data = deflate(src);
//    */

//   /* constant parameters */
//   var zip_WSIZE = 32768; // Sliding Window size
//   var zip_STORED_BLOCK = 0;
//   var zip_STATIC_TREES = 1;
//   var zip_DYN_TREES = 2;

//   /* for deflate */
//   var zip_DEFAULT_LEVEL = 6;
//   var zip_FULL_SEARCH = true;
//   var zip_INBUFSIZ = 32768; // Input buffer size
//   var zip_INBUF_EXTRA = 64; // Extra buffer
//   var zip_OUTBUFSIZ = 1024 * 8;
//   var zip_window_size = 2 * zip_WSIZE;
//   var zip_MIN_MATCH = 3;
//   var zip_MAX_MATCH = 258;
//   var zip_BITS = 16;
//   // for SMALL_MEM
//   var zip_LIT_BUFSIZE = 0x2000;
//   var zip_HASH_BITS = 13;
//   // for MEDIUM_MEM
//   // var zip_LIT_BUFSIZE = 0x4000;
//   // var zip_HASH_BITS = 14;
//   // for BIG_MEM
//   // var zip_LIT_BUFSIZE = 0x8000;
//   // var zip_HASH_BITS = 15;
//   //if(zip_LIT_BUFSIZE > zip_INBUFSIZ)
//   //    alert("error: zip_INBUFSIZ is too small");
//   //if((zip_WSIZE<<1) > (1<<zip_BITS))
//   //    alert("error: zip_WSIZE is too large");
//   //if(zip_HASH_BITS > zip_BITS-1)
//   //    alert("error: zip_HASH_BITS is too large");
//   //if(zip_HASH_BITS < 8 || zip_MAX_MATCH != 258)
//   //    alert("error: Code too clever");
//   var zip_DIST_BUFSIZE = zip_LIT_BUFSIZE;
//   var zip_HASH_SIZE = 1 << zip_HASH_BITS;
//   var zip_HASH_MASK = zip_HASH_SIZE - 1;
//   var zip_WMASK = zip_WSIZE - 1;
//   var zip_NIL = 0; // Tail of hash chains
//   var zip_TOO_FAR = 4096;
//   var zip_MIN_LOOKAHEAD = zip_MAX_MATCH + zip_MIN_MATCH + 1;
//   var zip_MAX_DIST = zip_WSIZE - zip_MIN_LOOKAHEAD;
//   var zip_SMALLEST = 1;
//   var zip_MAX_BITS = 15;
//   var zip_MAX_BL_BITS = 7;
//   var zip_LENGTH_CODES = 29;
//   var zip_LITERALS = 256;
//   var zip_END_BLOCK = 256;
//   var zip_L_CODES = zip_LITERALS + 1 + zip_LENGTH_CODES;
//   var zip_D_CODES = 30;
//   var zip_BL_CODES = 19;
//   var zip_REP_3_6 = 16;
//   var zip_REPZ_3_10 = 17;
//   var zip_REPZ_11_138 = 18;
//   var zip_HEAP_SIZE = 2 * zip_L_CODES + 1;
//   var zip_H_SHIFT = parseInt(
//     (zip_HASH_BITS + zip_MIN_MATCH - 1) / zip_MIN_MATCH
//   );

//   /* variables */
//   var zip_free_queue;
//   var zip_qhead, zip_qtail;
//   var zip_initflag;
//   var zip_outbuf = null;
//   var zip_outcnt, zip_outoff;
//   var zip_complete;
//   var zip_window;
//   var zip_d_buf;
//   var zip_l_buf;
//   var zip_prev;
//   var zip_bi_buf;
//   var zip_bi_valid;
//   var zip_block_start;
//   var zip_ins_h;
//   var zip_hash_head;
//   var zip_prev_match;
//   var zip_match_available;
//   var zip_match_length;
//   var zip_prev_length;
//   var zip_strstart;
//   var zip_match_start;
//   var zip_eofile;
//   var zip_lookahead;
//   var zip_max_chain_length;
//   var zip_max_lazy_match;
//   var zip_compr_level;
//   var zip_good_match;
//   var zip_nice_match;
//   var zip_dyn_ltree;
//   var zip_dyn_dtree;
//   var zip_static_ltree;
//   var zip_static_dtree;
//   var zip_bl_tree;
//   var zip_l_desc;
//   var zip_d_desc;
//   var zip_bl_desc;
//   var zip_bl_count;
//   var zip_heap;
//   var zip_heap_len;
//   var zip_heap_max;
//   var zip_depth;
//   var zip_length_code;
//   var zip_dist_code;
//   var zip_base_length;
//   var zip_base_dist;
//   var zip_flag_buf;
//   var zip_last_lit;
//   var zip_last_dist;
//   var zip_last_flags;
//   var zip_flags;
//   var zip_flag_bit;
//   var zip_opt_len;
//   var zip_static_len;
//   var zip_deflate_data;
//   var zip_deflate_pos;

//   /* objects (deflate) */

//   function zip_DeflateCT() {
//     this.fc = 0; // frequency count or bit string
//     this.dl = 0; // father node in Huffman tree or length of bit string
//   }

//   function zip_DeflateTreeDesc() {
//     this.dyn_tree = null; // the dynamic tree
//     this.static_tree = null; // corresponding static tree or NULL
//     this.extra_bits = null; // extra bits for each code or NULL
//     this.extra_base = 0; // base index for extra_bits
//     this.elems = 0; // max number of elements in the tree
//     this.max_length = 0; // max bit length for the codes
//     this.max_code = 0; // largest code with non zero frequency
//   }

//   /* Values for max_lazy_match, good_match and max_chain_length, depending on
//    * the desired pack level (0..9). The values given below have been tuned to
//    * exclude worst case performance for pathological files. Better values may be
//    * found for specific files.
//    */
//   function zip_DeflateConfiguration(a, b, c, d) {
//     this.good_length = a; // reduce lazy search above this match length
//     this.max_lazy = b; // do not perform lazy search above this match length
//     this.nice_length = c; // quit search above this match length
//     this.max_chain = d;
//   }

//   function zip_DeflateBuffer() {
//     this.next = null;
//     this.len = 0;
//     this.ptr = new Array(zip_OUTBUFSIZ);
//     this.off = 0;
//   }

//   /* constant tables */
//   var zip_extra_lbits = [
//     0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5,
//     5, 5, 5, 0,
//   ];
//   var zip_extra_dbits = [
//     0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10,
//     11, 11, 12, 12, 13, 13,
//   ];
//   var zip_extra_blbits = [
//     0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7,
//   ];
//   var zip_bl_order = [
//     16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
//   ];
//   var zip_configuration_table = [
//     new zip_DeflateConfiguration(0, 0, 0, 0),
//     new zip_DeflateConfiguration(4, 4, 8, 4),
//     new zip_DeflateConfiguration(4, 5, 16, 8),
//     new zip_DeflateConfiguration(4, 6, 32, 32),
//     new zip_DeflateConfiguration(4, 4, 16, 16),
//     new zip_DeflateConfiguration(8, 16, 32, 32),
//     new zip_DeflateConfiguration(8, 16, 128, 128),
//     new zip_DeflateConfiguration(8, 32, 128, 256),
//     new zip_DeflateConfiguration(32, 128, 258, 1024),
//     new zip_DeflateConfiguration(32, 258, 258, 4096),
//   ];

//   /* routines (deflate) */

//   function zip_deflate_start(level) {
//     var i;

//     if (!level) level = zip_DEFAULT_LEVEL;
//     else if (level < 1) level = 1;
//     else if (level > 9) level = 9;

//     zip_compr_level = level;
//     zip_initflag = false;
//     zip_eofile = false;
//     if (zip_outbuf != null) return;

//     zip_free_queue = zip_qhead = zip_qtail = null;
//     zip_outbuf = new Array(zip_OUTBUFSIZ);
//     zip_window = new Array(zip_window_size);
//     zip_d_buf = new Array(zip_DIST_BUFSIZE);
//     zip_l_buf = new Array(zip_INBUFSIZ + zip_INBUF_EXTRA);
//     zip_prev = new Array(1 << zip_BITS);
//     zip_dyn_ltree = new Array(zip_HEAP_SIZE);
//     for (i = 0; i < zip_HEAP_SIZE; i++) zip_dyn_ltree[i] = new zip_DeflateCT();
//     zip_dyn_dtree = new Array(2 * zip_D_CODES + 1);
//     for (i = 0; i < 2 * zip_D_CODES + 1; i++)
//       zip_dyn_dtree[i] = new zip_DeflateCT();
//     zip_static_ltree = new Array(zip_L_CODES + 2);
//     for (i = 0; i < zip_L_CODES + 2; i++)
//       zip_static_ltree[i] = new zip_DeflateCT();
//     zip_static_dtree = new Array(zip_D_CODES);
//     for (i = 0; i < zip_D_CODES; i++) zip_static_dtree[i] = new zip_DeflateCT();
//     zip_bl_tree = new Array(2 * zip_BL_CODES + 1);
//     for (i = 0; i < 2 * zip_BL_CODES + 1; i++)
//       zip_bl_tree[i] = new zip_DeflateCT();
//     zip_l_desc = new zip_DeflateTreeDesc();
//     zip_d_desc = new zip_DeflateTreeDesc();
//     zip_bl_desc = new zip_DeflateTreeDesc();
//     zip_bl_count = new Array(zip_MAX_BITS + 1);
//     zip_heap = new Array(2 * zip_L_CODES + 1);
//     zip_depth = new Array(2 * zip_L_CODES + 1);
//     zip_length_code = new Array(zip_MAX_MATCH - zip_MIN_MATCH + 1);
//     zip_dist_code = new Array(512);
//     zip_base_length = new Array(zip_LENGTH_CODES);
//     zip_base_dist = new Array(zip_D_CODES);
//     zip_flag_buf = new Array(parseInt(zip_LIT_BUFSIZE / 8));
//   }

//   function zip_deflate_end() {
//     zip_free_queue = zip_qhead = zip_qtail = null;
//     zip_outbuf = null;
//     zip_window = null;
//     zip_d_buf = null;
//     zip_l_buf = null;
//     zip_prev = null;
//     zip_dyn_ltree = null;
//     zip_dyn_dtree = null;
//     zip_static_ltree = null;
//     zip_static_dtree = null;
//     zip_bl_tree = null;
//     zip_l_desc = null;
//     zip_d_desc = null;
//     zip_bl_desc = null;
//     zip_bl_count = null;
//     zip_heap = null;
//     zip_depth = null;
//     zip_length_code = null;
//     zip_dist_code = null;
//     zip_base_length = null;
//     zip_base_dist = null;
//     zip_flag_buf = null;
//   }

//   function zip_reuse_queue(p) {
//     p.next = zip_free_queue;
//     zip_free_queue = p;
//   }

//   function zip_new_queue() {
//     var p;

//     if (zip_free_queue != null) {
//       p = zip_free_queue;
//       zip_free_queue = zip_free_queue.next;
//     } else p = new zip_DeflateBuffer();
//     p.next = null;
//     p.len = p.off = 0;

//     return p;
//   }

//   function zip_head1(i) {
//     return zip_prev[zip_WSIZE + i];
//   }

//   function zip_head2(i, val) {
//     return (zip_prev[zip_WSIZE + i] = val);
//   }

//   /* put_byte is used for the compressed output, put_ubyte for the
//    * uncompressed output. However unlzw() uses window for its
//    * suffix table instead of its output buffer, so it does not use put_ubyte
//    * (to be cleaned up).
//    */
//   function zip_put_byte(c) {
//     zip_outbuf[zip_outoff + zip_outcnt++] = c;
//     if (zip_outoff + zip_outcnt == zip_OUTBUFSIZ) zip_qoutbuf();
//   }

//   /* Output a 16 bit value, lsb first */
//   function zip_put_short(w) {
//     w &= 0xffff;
//     if (zip_outoff + zip_outcnt < zip_OUTBUFSIZ - 2) {
//       zip_outbuf[zip_outoff + zip_outcnt++] = w & 0xff;
//       zip_outbuf[zip_outoff + zip_outcnt++] = w >>> 8;
//     } else {
//       zip_put_byte(w & 0xff);
//       zip_put_byte(w >>> 8);
//     }
//   }

//   /* ==========================================================================
//    * Insert string s in the dictionary and set match_head to the previous head
//    * of the hash chain (the most recent string with same hash key). Return
//    * the previous length of the hash chain.
//    * IN  assertion: all calls to to INSERT_STRING are made with consecutive
//    *    input characters and the first MIN_MATCH bytes of s are valid
//    *    (except for the last MIN_MATCH-1 bytes of the input file).
//    */
//   function zip_INSERT_STRING() {
//     zip_ins_h =
//       ((zip_ins_h << zip_H_SHIFT) ^
//         (zip_window[zip_strstart + zip_MIN_MATCH - 1] & 0xff)) &
//       zip_HASH_MASK;
//     zip_hash_head = zip_head1(zip_ins_h);
//     zip_prev[zip_strstart & zip_WMASK] = zip_hash_head;
//     zip_head2(zip_ins_h, zip_strstart);
//   }

//   /* Send a code of the given tree. c and tree must not have side effects */
//   function zip_SEND_CODE(c, tree) {
//     zip_send_bits(tree[c].fc, tree[c].dl);
//   }

//   /* Mapping from a distance to a distance code. dist is the distance - 1 and
//    * must not have side effects. dist_code[256] and dist_code[257] are never
//    * used.
//    */
//   function zip_D_CODE(dist) {
//     return (
//       (dist < 256 ? zip_dist_code[dist] : zip_dist_code[256 + (dist >> 7)]) &
//       0xff
//     );
//   }

//   /* ==========================================================================
//    * Compares to subtrees, using the tree depth as tie breaker when
//    * the subtrees have equal frequency. This minimizes the worst case length.
//    */
//   function zip_SMALLER(tree, n, m) {
//     return (
//       tree[n].fc < tree[m].fc ||
//       (tree[n].fc == tree[m].fc && zip_depth[n] <= zip_depth[m])
//     );
//   }

//   /* ==========================================================================
//    * read string data
//    */
//   function zip_read_buff(buff, offset, n) {
//     var i;
//     for (i = 0; i < n && zip_deflate_pos < zip_deflate_data.length; i++)
//       buff[offset + i] = zip_deflate_data.charCodeAt(zip_deflate_pos++) & 0xff;
//     return i;
//   }

//   /* ==========================================================================
//    * Initialize the "longest match" routines for a new file
//    */
//   function zip_lm_init() {
//     var j;

//     /* Initialize the hash table. */
//     for (j = 0; j < zip_HASH_SIZE; j++)
//       //	zip_head2(j, zip_NIL);
//       zip_prev[zip_WSIZE + j] = 0;
//     /* prev will be initialized on the fly */

//     /* Set the default configuration parameters:
//      */
//     zip_max_lazy_match = zip_configuration_table[zip_compr_level].max_lazy;
//     zip_good_match = zip_configuration_table[zip_compr_level].good_length;
//     if (!zip_FULL_SEARCH)
//       zip_nice_match = zip_configuration_table[zip_compr_level].nice_length;
//     zip_max_chain_length = zip_configuration_table[zip_compr_level].max_chain;

//     zip_strstart = 0;
//     zip_block_start = 0;

//     zip_lookahead = zip_read_buff(zip_window, 0, 2 * zip_WSIZE);
//     if (zip_lookahead <= 0) {
//       zip_eofile = true;
//       zip_lookahead = 0;
//       return;
//     }
//     zip_eofile = false;
//     /* Make sure that we always have enough lookahead. This is important
//      * if input comes from a device such as a tty.
//      */
//     while (zip_lookahead < zip_MIN_LOOKAHEAD && !zip_eofile) zip_fill_window();

//     /* If lookahead < MIN_MATCH, ins_h is garbage, but this is
//      * not important since only literal bytes will be emitted.
//      */
//     zip_ins_h = 0;
//     for (j = 0; j < zip_MIN_MATCH - 1; j++) {
//       //      UPDATE_HASH(ins_h, window[j]);
//       zip_ins_h =
//         ((zip_ins_h << zip_H_SHIFT) ^ (zip_window[j] & 0xff)) & zip_HASH_MASK;
//     }
//   }

//   /* ==========================================================================
//    * Set match_start to the longest match starting at the given string and
//    * return its length. Matches shorter or equal to prev_length are discarded,
//    * in which case the result is equal to prev_length and match_start is
//    * garbage.
//    * IN assertions: cur_match is the head of the hash chain for the current
//    *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
//    */
//   function zip_longest_match(cur_match) {
//     var chain_length = zip_max_chain_length; // max hash chain length
//     var scanp = zip_strstart; // current string
//     var matchp; // matched string
//     var len; // length of current match
//     var best_len = zip_prev_length; // best match length so far

//     /* Stop when cur_match becomes <= limit. To simplify the code,
//      * we prevent matches with the string of window index 0.
//      */
//     var limit =
//       zip_strstart > zip_MAX_DIST ? zip_strstart - zip_MAX_DIST : zip_NIL;

//     var strendp = zip_strstart + zip_MAX_MATCH;
//     var scan_end1 = zip_window[scanp + best_len - 1];
//     var scan_end = zip_window[scanp + best_len];

//     /* Do not waste too much time if we already have a good match: */
//     if (zip_prev_length >= zip_good_match) chain_length >>= 2;

//     //  Assert(encoder->strstart <= window_size-MIN_LOOKAHEAD, "insufficient lookahead");

//     do {
//       //    Assert(cur_match < encoder->strstart, "no future");
//       matchp = cur_match;

//       /* Skip to next match if the match length cannot increase
//        * or if the match length is less than 2:
//        */
//       if (
//         zip_window[matchp + best_len] != scan_end ||
//         zip_window[matchp + best_len - 1] != scan_end1 ||
//         zip_window[matchp] != zip_window[scanp] ||
//         zip_window[++matchp] != zip_window[scanp + 1]
//       ) {
//         continue;
//       }

//       /* The check at best_len-1 can be removed because it will be made
//        * again later. (This heuristic is not always a win.)
//        * It is not necessary to compare scan[2] and match[2] since they
//        * are always equal when the other bytes match, given that
//        * the hash keys are equal and that HASH_BITS >= 8.
//        */
//       scanp += 2;
//       matchp++;

//       /* We check for insufficient lookahead only every 8th comparison;
//        * the 256th check will be made at strstart+258.
//        */
//       do {} while (
//         zip_window[++scanp] == zip_window[++matchp] &&
//         zip_window[++scanp] == zip_window[++matchp] &&
//         zip_window[++scanp] == zip_window[++matchp] &&
//         zip_window[++scanp] == zip_window[++matchp] &&
//         zip_window[++scanp] == zip_window[++matchp] &&
//         zip_window[++scanp] == zip_window[++matchp] &&
//         zip_window[++scanp] == zip_window[++matchp] &&
//         zip_window[++scanp] == zip_window[++matchp] &&
//         scanp < strendp
//       );

//       len = zip_MAX_MATCH - (strendp - scanp);
//       scanp = strendp - zip_MAX_MATCH;

//       if (len > best_len) {
//         zip_match_start = cur_match;
//         best_len = len;
//         if (zip_FULL_SEARCH) {
//           if (len >= zip_MAX_MATCH) break;
//         } else {
//           if (len >= zip_nice_match) break;
//         }

//         scan_end1 = zip_window[scanp + best_len - 1];
//         scan_end = zip_window[scanp + best_len];
//       }
//     } while (
//       (cur_match = zip_prev[cur_match & zip_WMASK]) > limit &&
//       --chain_length != 0
//     );

//     return best_len;
//   }

//   /* ==========================================================================
//    * Fill the window when the lookahead becomes insufficient.
//    * Updates strstart and lookahead, and sets eofile if end of input file.
//    * IN assertion: lookahead < MIN_LOOKAHEAD && strstart + lookahead > 0
//    * OUT assertions: at least one byte has been read, or eofile is set;
//    *    file reads are performed for at least two bytes (required for the
//    *    translate_eol option).
//    */
//   function zip_fill_window() {
//     var n, m;

//     // Amount of free space at the end of the window.
//     var more = zip_window_size - zip_lookahead - zip_strstart;

//     /* If the window is almost full and there is insufficient lookahead,
//      * move the upper half to the lower one to make room in the upper half.
//      */
//     if (more == -1) {
//       /* Very unlikely, but possible on 16 bit machine if strstart == 0
//        * and lookahead == 1 (input done one byte at time)
//        */
//       more--;
//     } else if (zip_strstart >= zip_WSIZE + zip_MAX_DIST) {
//       /* By the IN assertion, the window is not empty so we can't confuse
//        * more == 0 with more == 64K on a 16 bit machine.
//        */
//       //	Assert(window_size == (ulg)2*WSIZE, "no sliding with BIG_MEM");

//       //	System.arraycopy(window, WSIZE, window, 0, WSIZE);
//       for (n = 0; n < zip_WSIZE; n++) zip_window[n] = zip_window[n + zip_WSIZE];

//       zip_match_start -= zip_WSIZE;
//       zip_strstart -= zip_WSIZE; /* we now have strstart >= MAX_DIST: */
//       zip_block_start -= zip_WSIZE;

//       for (n = 0; n < zip_HASH_SIZE; n++) {
//         m = zip_head1(n);
//         zip_head2(n, m >= zip_WSIZE ? m - zip_WSIZE : zip_NIL);
//       }
//       for (n = 0; n < zip_WSIZE; n++) {
//         /* If n is not on any hash chain, prev[n] is garbage but
//          * its value will never be used.
//          */
//         m = zip_prev[n];
//         zip_prev[n] = m >= zip_WSIZE ? m - zip_WSIZE : zip_NIL;
//       }
//       more += zip_WSIZE;
//     }
//     // At this point, more >= 2
//     if (!zip_eofile) {
//       n = zip_read_buff(zip_window, zip_strstart + zip_lookahead, more);
//       if (n <= 0) zip_eofile = true;
//       else zip_lookahead += n;
//     }
//   }

//   /* ==========================================================================
//    * Processes a new input file and return its compressed length. This
//    * function does not perform lazy evaluationof matches and inserts
//    * new strings in the dictionary only for unmatched strings or for short
//    * matches. It is used only for the fast compression options.
//    */
//   function zip_deflate_fast() {
//     while (zip_lookahead != 0 && zip_qhead == null) {
//       var flush; // set if current block must be flushed

//       /* Insert the string window[strstart .. strstart+2] in the
//        * dictionary, and set hash_head to the head of the hash chain:
//        */
//       zip_INSERT_STRING();

//       /* Find the longest match, discarding those <= prev_length.
//        * At this point we have always match_length < MIN_MATCH
//        */
//       if (
//         zip_hash_head != zip_NIL &&
//         zip_strstart - zip_hash_head <= zip_MAX_DIST
//       ) {
//         /* To simplify the code, we prevent matches with the string
//          * of window index 0 (in particular we have to avoid a match
//          * of the string with itself at the start of the input file).
//          */
//         zip_match_length = zip_longest_match(zip_hash_head);
//         /* longest_match() sets match_start */
//         if (zip_match_length > zip_lookahead) zip_match_length = zip_lookahead;
//       }
//       if (zip_match_length >= zip_MIN_MATCH) {
//         //	    check_match(strstart, match_start, match_length);

//         flush = zip_ct_tally(
//           zip_strstart - zip_match_start,
//           zip_match_length - zip_MIN_MATCH
//         );
//         zip_lookahead -= zip_match_length;

//         /* Insert new strings in the hash table only if the match length
//          * is not too large. This saves time but degrades compression.
//          */
//         if (zip_match_length <= zip_max_lazy_match) {
//           zip_match_length--; // string at strstart already in hash table
//           do {
//             zip_strstart++;
//             zip_INSERT_STRING();
//             /* strstart never exceeds WSIZE-MAX_MATCH, so there are
//              * always MIN_MATCH bytes ahead. If lookahead < MIN_MATCH
//              * these bytes are garbage, but it does not matter since
//              * the next lookahead bytes will be emitted as literals.
//              */
//           } while (--zip_match_length != 0);
//           zip_strstart++;
//         } else {
//           zip_strstart += zip_match_length;
//           zip_match_length = 0;
//           zip_ins_h = zip_window[zip_strstart] & 0xff;
//           //		UPDATE_HASH(ins_h, window[strstart + 1]);
//           zip_ins_h =
//             ((zip_ins_h << zip_H_SHIFT) ^
//               (zip_window[zip_strstart + 1] & 0xff)) &
//             zip_HASH_MASK;

//           //#if MIN_MATCH != 3
//           //		Call UPDATE_HASH() MIN_MATCH-3 more times
//           //#endif
//         }
//       } else {
//         /* No match, output a literal byte */
//         flush = zip_ct_tally(0, zip_window[zip_strstart] & 0xff);
//         zip_lookahead--;
//         zip_strstart++;
//       }
//       if (flush) {
//         zip_flush_block(0);
//         zip_block_start = zip_strstart;
//       }

//       /* Make sure that we always have enough lookahead, except
//        * at the end of the input file. We need MAX_MATCH bytes
//        * for the next match, plus MIN_MATCH bytes to insert the
//        * string following the next match.
//        */
//       while (zip_lookahead < zip_MIN_LOOKAHEAD && !zip_eofile)
//         zip_fill_window();
//     }
//   }

//   function zip_deflate_better() {
//     /* Process the input block. */
//     while (zip_lookahead != 0 && zip_qhead == null) {
//       /* Insert the string window[strstart .. strstart+2] in the
//        * dictionary, and set hash_head to the head of the hash chain:
//        */
//       zip_INSERT_STRING();

//       /* Find the longest match, discarding those <= prev_length.
//        */
//       zip_prev_length = zip_match_length;
//       zip_prev_match = zip_match_start;
//       zip_match_length = zip_MIN_MATCH - 1;

//       if (
//         zip_hash_head != zip_NIL &&
//         zip_prev_length < zip_max_lazy_match &&
//         zip_strstart - zip_hash_head <= zip_MAX_DIST
//       ) {
//         /* To simplify the code, we prevent matches with the string
//          * of window index 0 (in particular we have to avoid a match
//          * of the string with itself at the start of the input file).
//          */
//         zip_match_length = zip_longest_match(zip_hash_head);
//         /* longest_match() sets match_start */
//         if (zip_match_length > zip_lookahead) zip_match_length = zip_lookahead;

//         /* Ignore a length 3 match if it is too distant: */
//         if (
//           zip_match_length == zip_MIN_MATCH &&
//           zip_strstart - zip_match_start > zip_TOO_FAR
//         ) {
//           /* If prev_match is also MIN_MATCH, match_start is garbage
//            * but we will ignore the current match anyway.
//            */
//           zip_match_length--;
//         }
//       }
//       /* If there was a match at the previous step and the current
//        * match is not better, output the previous match:
//        */
//       if (
//         zip_prev_length >= zip_MIN_MATCH &&
//         zip_match_length <= zip_prev_length
//       ) {
//         var flush; // set if current block must be flushed

//         //	    check_match(strstart - 1, prev_match, prev_length);
//         flush = zip_ct_tally(
//           zip_strstart - 1 - zip_prev_match,
//           zip_prev_length - zip_MIN_MATCH
//         );

//         /* Insert in hash table all strings up to the end of the match.
//          * strstart-1 and strstart are already inserted.
//          */
//         zip_lookahead -= zip_prev_length - 1;
//         zip_prev_length -= 2;
//         do {
//           zip_strstart++;
//           zip_INSERT_STRING();
//           /* strstart never exceeds WSIZE-MAX_MATCH, so there are
//            * always MIN_MATCH bytes ahead. If lookahead < MIN_MATCH
//            * these bytes are garbage, but it does not matter since the
//            * next lookahead bytes will always be emitted as literals.
//            */
//         } while (--zip_prev_length != 0);
//         zip_match_available = 0;
//         zip_match_length = zip_MIN_MATCH - 1;
//         zip_strstart++;
//         if (flush) {
//           zip_flush_block(0);
//           zip_block_start = zip_strstart;
//         }
//       } else if (zip_match_available != 0) {
//         /* If there was no match at the previous position, output a
//          * single literal. If there was a match but the current match
//          * is longer, truncate the previous match to a single literal.
//          */
//         if (zip_ct_tally(0, zip_window[zip_strstart - 1] & 0xff)) {
//           zip_flush_block(0);
//           zip_block_start = zip_strstart;
//         }
//         zip_strstart++;
//         zip_lookahead--;
//       } else {
//         /* There is no previous match to compare with, wait for
//          * the next step to decide.
//          */
//         zip_match_available = 1;
//         zip_strstart++;
//         zip_lookahead--;
//       }

//       /* Make sure that we always have enough lookahead, except
//        * at the end of the input file. We need MAX_MATCH bytes
//        * for the next match, plus MIN_MATCH bytes to insert the
//        * string following the next match.
//        */
//       while (zip_lookahead < zip_MIN_LOOKAHEAD && !zip_eofile)
//         zip_fill_window();
//     }
//   }

//   function zip_init_deflate() {
//     if (zip_eofile) return;
//     zip_bi_buf = 0;
//     zip_bi_valid = 0;
//     zip_ct_init();
//     zip_lm_init();

//     zip_qhead = null;
//     zip_outcnt = 0;
//     zip_outoff = 0;

//     if (zip_compr_level <= 3) {
//       zip_prev_length = zip_MIN_MATCH - 1;
//       zip_match_length = 0;
//     } else {
//       zip_match_length = zip_MIN_MATCH - 1;
//       zip_match_available = 0;
//     }

//     zip_complete = false;
//   }

//   /* ==========================================================================
//    * Same as above, but achieves better compression. We use a lazy
//    * evaluation for matches: a match is finally adopted only if there is
//    * no better match at the next window position.
//    */
//   function zip_deflate_internal(buff, off, buff_size) {
//     var n;

//     if (!zip_initflag) {
//       zip_init_deflate();
//       zip_initflag = true;
//       if (zip_lookahead == 0) {
//         // empty
//         zip_complete = true;
//         return 0;
//       }
//     }

//     if ((n = zip_qcopy(buff, off, buff_size)) == buff_size) return buff_size;

//     if (zip_complete) return n;

//     if (zip_compr_level <= 3)
//       // optimized for speed
//       zip_deflate_fast();
//     else zip_deflate_better();
//     if (zip_lookahead == 0) {
//       if (zip_match_available != 0)
//         zip_ct_tally(0, zip_window[zip_strstart - 1] & 0xff);
//       zip_flush_block(1);
//       zip_complete = true;
//     }
//     return n + zip_qcopy(buff, n + off, buff_size - n);
//   }

//   function zip_qcopy(buff, off, buff_size) {
//     var n, i, j;

//     n = 0;
//     while (zip_qhead != null && n < buff_size) {
//       i = buff_size - n;
//       if (i > zip_qhead.len) i = zip_qhead.len;
//       //      System.arraycopy(qhead.ptr, qhead.off, buff, off + n, i);
//       for (j = 0; j < i; j++)
//         buff[off + n + j] = zip_qhead.ptr[zip_qhead.off + j];

//       zip_qhead.off += i;
//       zip_qhead.len -= i;
//       n += i;
//       if (zip_qhead.len == 0) {
//         var p;
//         p = zip_qhead;
//         zip_qhead = zip_qhead.next;
//         zip_reuse_queue(p);
//       }
//     }

//     if (n == buff_size) return n;

//     if (zip_outoff < zip_outcnt) {
//       i = buff_size - n;
//       if (i > zip_outcnt - zip_outoff) i = zip_outcnt - zip_outoff;
//       // System.arraycopy(outbuf, outoff, buff, off + n, i);
//       for (j = 0; j < i; j++) buff[off + n + j] = zip_outbuf[zip_outoff + j];
//       zip_outoff += i;
//       n += i;
//       if (zip_outcnt == zip_outoff) zip_outcnt = zip_outoff = 0;
//     }
//     return n;
//   }

//   /* ==========================================================================
//    * Allocate the match buffer, initialize the various tables and save the
//    * location of the internal file attribute (ascii/binary) and method
//    * (DEFLATE/STORE).
//    */
//   function zip_ct_init() {
//     var n; // iterates over tree elements
//     var bits; // bit counter
//     var length; // length value
//     var code; // code value
//     var dist; // distance index

//     if (zip_static_dtree[0].dl != 0) return; // ct_init already called

//     zip_l_desc.dyn_tree = zip_dyn_ltree;
//     zip_l_desc.static_tree = zip_static_ltree;
//     zip_l_desc.extra_bits = zip_extra_lbits;
//     zip_l_desc.extra_base = zip_LITERALS + 1;
//     zip_l_desc.elems = zip_L_CODES;
//     zip_l_desc.max_length = zip_MAX_BITS;
//     zip_l_desc.max_code = 0;

//     zip_d_desc.dyn_tree = zip_dyn_dtree;
//     zip_d_desc.static_tree = zip_static_dtree;
//     zip_d_desc.extra_bits = zip_extra_dbits;
//     zip_d_desc.extra_base = 0;
//     zip_d_desc.elems = zip_D_CODES;
//     zip_d_desc.max_length = zip_MAX_BITS;
//     zip_d_desc.max_code = 0;

//     zip_bl_desc.dyn_tree = zip_bl_tree;
//     zip_bl_desc.static_tree = null;
//     zip_bl_desc.extra_bits = zip_extra_blbits;
//     zip_bl_desc.extra_base = 0;
//     zip_bl_desc.elems = zip_BL_CODES;
//     zip_bl_desc.max_length = zip_MAX_BL_BITS;
//     zip_bl_desc.max_code = 0;

//     // Initialize the mapping length (0..255) -> length code (0..28)
//     length = 0;
//     for (code = 0; code < zip_LENGTH_CODES - 1; code++) {
//       zip_base_length[code] = length;
//       for (n = 0; n < 1 << zip_extra_lbits[code]; n++)
//         zip_length_code[length++] = code;
//     }
//     // Assert (length == 256, "ct_init: length != 256");

//     /* Note that the length 255 (match length 258) can be represented
//      * in two different ways: code 284 + 5 bits or code 285, so we
//      * overwrite length_code[255] to use the best encoding:
//      */
//     zip_length_code[length - 1] = code;

//     /* Initialize the mapping dist (0..32K) -> dist code (0..29) */
//     dist = 0;
//     for (code = 0; code < 16; code++) {
//       zip_base_dist[code] = dist;
//       for (n = 0; n < 1 << zip_extra_dbits[code]; n++) {
//         zip_dist_code[dist++] = code;
//       }
//     }
//     // Assert (dist == 256, "ct_init: dist != 256");
//     dist >>= 7; // from now on, all distances are divided by 128
//     for (; code < zip_D_CODES; code++) {
//       zip_base_dist[code] = dist << 7;
//       for (n = 0; n < 1 << (zip_extra_dbits[code] - 7); n++)
//         zip_dist_code[256 + dist++] = code;
//     }
//     // Assert (dist == 256, "ct_init: 256+dist != 512");

//     // Construct the codes of the static literal tree
//     for (bits = 0; bits <= zip_MAX_BITS; bits++) zip_bl_count[bits] = 0;
//     n = 0;
//     while (n <= 143) {
//       zip_static_ltree[n++].dl = 8;
//       zip_bl_count[8]++;
//     }
//     while (n <= 255) {
//       zip_static_ltree[n++].dl = 9;
//       zip_bl_count[9]++;
//     }
//     while (n <= 279) {
//       zip_static_ltree[n++].dl = 7;
//       zip_bl_count[7]++;
//     }
//     while (n <= 287) {
//       zip_static_ltree[n++].dl = 8;
//       zip_bl_count[8]++;
//     }
//     /* Codes 286 and 287 do not exist, but we must include them in the
//      * tree construction to get a canonical Huffman tree (longest code
//      * all ones)
//      */
//     zip_gen_codes(zip_static_ltree, zip_L_CODES + 1);

//     /* The static distance tree is trivial: */
//     for (n = 0; n < zip_D_CODES; n++) {
//       zip_static_dtree[n].dl = 5;
//       zip_static_dtree[n].fc = zip_bi_reverse(n, 5);
//     }

//     // Initialize the first block of the first file:
//     zip_init_block();
//   }

//   /* ==========================================================================
//    * Initialize a new block.
//    */
//   function zip_init_block() {
//     var n; // iterates over tree elements

//     // Initialize the trees.
//     for (n = 0; n < zip_L_CODES; n++) zip_dyn_ltree[n].fc = 0;
//     for (n = 0; n < zip_D_CODES; n++) zip_dyn_dtree[n].fc = 0;
//     for (n = 0; n < zip_BL_CODES; n++) zip_bl_tree[n].fc = 0;

//     zip_dyn_ltree[zip_END_BLOCK].fc = 1;
//     zip_opt_len = zip_static_len = 0;
//     zip_last_lit = zip_last_dist = zip_last_flags = 0;
//     zip_flags = 0;
//     zip_flag_bit = 1;
//   }

//   /* ==========================================================================
//    * Restore the heap property by moving down the tree starting at node k,
//    * exchanging a node with the smallest of its two sons if necessary, stopping
//    * when the heap property is re-established (each father smaller than its
//    * two sons).
//    */
//   function zip_pqdownheap(
//     tree, // the tree to restore
//     k
//   ) {
//     // node to move down
//     var v = zip_heap[k];
//     var j = k << 1; // left son of k

//     while (j <= zip_heap_len) {
//       // Set j to the smallest of the two sons:
//       if (j < zip_heap_len && zip_SMALLER(tree, zip_heap[j + 1], zip_heap[j]))
//         j++;

//       // Exit if v is smaller than both sons
//       if (zip_SMALLER(tree, v, zip_heap[j])) break;

//       // Exchange v with the smallest son
//       zip_heap[k] = zip_heap[j];
//       k = j;

//       // And continue down the tree, setting j to the left son of k
//       j <<= 1;
//     }
//     zip_heap[k] = v;
//   }

//   /* ==========================================================================
//    * Compute the optimal bit lengths for a tree and update the total bit length
//    * for the current block.
//    * IN assertion: the fields freq and dad are set, heap[heap_max] and
//    *    above are the tree nodes sorted by increasing frequency.
//    * OUT assertions: the field len is set to the optimal bit length, the
//    *     array bl_count contains the frequencies for each bit length.
//    *     The length opt_len is updated; static_len is also updated if stree is
//    *     not null.
//    */
//   function zip_gen_bitlen(desc) {
//     // the tree descriptor
//     var tree = desc.dyn_tree;
//     var extra = desc.extra_bits;
//     var base = desc.extra_base;
//     var max_code = desc.max_code;
//     var max_length = desc.max_length;
//     var stree = desc.static_tree;
//     var h; // heap index
//     var n, m; // iterate over the tree elements
//     var bits; // bit length
//     var xbits; // extra bits
//     var f; // frequency
//     var overflow = 0; // number of elements with bit length too large

//     for (bits = 0; bits <= zip_MAX_BITS; bits++) zip_bl_count[bits] = 0;

//     /* In a first pass, compute the optimal bit lengths (which may
//      * overflow in the case of the bit length tree).
//      */
//     tree[zip_heap[zip_heap_max]].dl = 0; // root of the heap

//     for (h = zip_heap_max + 1; h < zip_HEAP_SIZE; h++) {
//       n = zip_heap[h];
//       bits = tree[tree[n].dl].dl + 1;
//       if (bits > max_length) {
//         bits = max_length;
//         overflow++;
//       }
//       tree[n].dl = bits;
//       // We overwrite tree[n].dl which is no longer needed

//       if (n > max_code) continue; // not a leaf node

//       zip_bl_count[bits]++;
//       xbits = 0;
//       if (n >= base) xbits = extra[n - base];
//       f = tree[n].fc;
//       zip_opt_len += f * (bits + xbits);
//       if (stree != null) zip_static_len += f * (stree[n].dl + xbits);
//     }
//     if (overflow == 0) return;

//     // This happens for example on obj2 and pic of the Calgary corpus

//     // Find the first bit length which could increase:
//     do {
//       bits = max_length - 1;
//       while (zip_bl_count[bits] == 0) bits--;
//       zip_bl_count[bits]--; // move one leaf down the tree
//       zip_bl_count[bits + 1] += 2; // move one overflow item as its brother
//       zip_bl_count[max_length]--;
//       /* The brother of the overflow item also moves one step up,
//        * but this does not affect bl_count[max_length]
//        */
//       overflow -= 2;
//     } while (overflow > 0);

//     /* Now recompute all bit lengths, scanning in increasing frequency.
//      * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
//      * lengths instead of fixing only the wrong ones. This idea is taken
//      * from 'ar' written by Haruhiko Okumura.)
//      */
//     for (bits = max_length; bits != 0; bits--) {
//       n = zip_bl_count[bits];
//       while (n != 0) {
//         m = zip_heap[--h];
//         if (m > max_code) continue;
//         if (tree[m].dl != bits) {
//           zip_opt_len += (bits - tree[m].dl) * tree[m].fc;
//           tree[m].fc = bits;
//         }
//         n--;
//       }
//     }
//   }

//   /* ==========================================================================
//    * Generate the codes for a given tree and bit counts (which need not be
//    * optimal).
//    * IN assertion: the array bl_count contains the bit length statistics for
//    * the given tree and the field len is set for all tree elements.
//    * OUT assertion: the field code is set for all tree elements of non
//    *     zero code length.
//    */
//   function zip_gen_codes(
//     tree, // the tree to decorate
//     max_code
//   ) {
//     // largest code with non zero frequency
//     var next_code = new Array(zip_MAX_BITS + 1); // next code value for each bit length
//     var code = 0; // running code value
//     var bits; // bit index
//     var n; // code index

//     /* The distribution counts are first used to generate the code values
//      * without bit reversal.
//      */
//     for (bits = 1; bits <= zip_MAX_BITS; bits++) {
//       code = (code + zip_bl_count[bits - 1]) << 1;
//       next_code[bits] = code;
//     }

//     /* Check that the bit counts in bl_count are consistent. The last code
//      * must be all ones.
//      */
//     //    Assert (code + encoder->bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
//     //	    "inconsistent bit counts");
//     //    Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

//     for (n = 0; n <= max_code; n++) {
//       var len = tree[n].dl;
//       if (len == 0) continue;
//       // Now reverse the bits
//       tree[n].fc = zip_bi_reverse(next_code[len]++, len);

//       //      Tracec(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
//       //	  n, (isgraph(n) ? n : ' '), len, tree[n].fc, next_code[len]-1));
//     }
//   }

//   /* ==========================================================================
//    * Construct one Huffman tree and assigns the code bit strings and lengths.
//    * Update the total bit length for the current block.
//    * IN assertion: the field freq is set for all tree elements.
//    * OUT assertions: the fields len and code are set to the optimal bit length
//    *     and corresponding code. The length opt_len is updated; static_len is
//    *     also updated if stree is not null. The field max_code is set.
//    */
//   function zip_build_tree(desc) {
//     // the tree descriptor
//     var tree = desc.dyn_tree;
//     var stree = desc.static_tree;
//     var elems = desc.elems;
//     var n, m; // iterate over heap elements
//     var max_code = -1; // largest code with non zero frequency
//     var node = elems; // next internal node of the tree

//     /* Construct the initial heap, with least frequent element in
//      * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
//      * heap[0] is not used.
//      */
//     zip_heap_len = 0;
//     zip_heap_max = zip_HEAP_SIZE;

//     for (n = 0; n < elems; n++) {
//       if (tree[n].fc != 0) {
//         zip_heap[++zip_heap_len] = max_code = n;
//         zip_depth[n] = 0;
//       } else tree[n].dl = 0;
//     }

//     /* The pkzip format requires that at least one distance code exists,
//      * and that at least one bit should be sent even if there is only one
//      * possible code. So to avoid special checks later on we force at least
//      * two codes of non zero frequency.
//      */
//     while (zip_heap_len < 2) {
//       var xnew = (zip_heap[++zip_heap_len] = max_code < 2 ? ++max_code : 0);
//       tree[xnew].fc = 1;
//       zip_depth[xnew] = 0;
//       zip_opt_len--;
//       if (stree != null) zip_static_len -= stree[xnew].dl;
//       // new is 0 or 1 so it does not have extra bits
//     }
//     desc.max_code = max_code;

//     /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
//      * establish sub-heaps of increasing lengths:
//      */
//     for (n = zip_heap_len >> 1; n >= 1; n--) zip_pqdownheap(tree, n);

//     /* Construct the Huffman tree by repeatedly combining the least two
//      * frequent nodes.
//      */
//     do {
//       n = zip_heap[zip_SMALLEST];
//       zip_heap[zip_SMALLEST] = zip_heap[zip_heap_len--];
//       zip_pqdownheap(tree, zip_SMALLEST);

//       m = zip_heap[zip_SMALLEST]; // m = node of next least frequency

//       // keep the nodes sorted by frequency
//       zip_heap[--zip_heap_max] = n;
//       zip_heap[--zip_heap_max] = m;

//       // Create a new node father of n and m
//       tree[node].fc = tree[n].fc + tree[m].fc;
//       //	depth[node] = (char)(MAX(depth[n], depth[m]) + 1);
//       if (zip_depth[n] > zip_depth[m] + 1) zip_depth[node] = zip_depth[n];
//       else zip_depth[node] = zip_depth[m] + 1;
//       tree[n].dl = tree[m].dl = node;

//       // and insert the new node in the heap
//       zip_heap[zip_SMALLEST] = node++;
//       zip_pqdownheap(tree, zip_SMALLEST);
//     } while (zip_heap_len >= 2);

//     zip_heap[--zip_heap_max] = zip_heap[zip_SMALLEST];

//     /* At this point, the fields freq and dad are set. We can now
//      * generate the bit lengths.
//      */
//     zip_gen_bitlen(desc);

//     // The field len is now set, we can generate the bit codes
//     zip_gen_codes(tree, max_code);
//   }

//   /* ==========================================================================
//    * Scan a literal or distance tree to determine the frequencies of the codes
//    * in the bit length tree. Updates opt_len to take into account the repeat
//    * counts. (The contribution of the bit length codes will be added later
//    * during the construction of bl_tree.)
//    */
//   function zip_scan_tree(
//     tree, // the tree to be scanned
//     max_code
//   ) {
//     // and its largest code of non zero frequency
//     var n; // iterates over all tree elements
//     var prevlen = -1; // last emitted length
//     var curlen; // length of current code
//     var nextlen = tree[0].dl; // length of next code
//     var count = 0; // repeat count of the current code
//     var max_count = 7; // max repeat count
//     var min_count = 4; // min repeat count

//     if (nextlen == 0) {
//       max_count = 138;
//       min_count = 3;
//     }
//     tree[max_code + 1].dl = 0xffff; // guard

//     for (n = 0; n <= max_code; n++) {
//       curlen = nextlen;
//       nextlen = tree[n + 1].dl;
//       if (++count < max_count && curlen == nextlen) continue;
//       else if (count < min_count) zip_bl_tree[curlen].fc += count;
//       else if (curlen != 0) {
//         if (curlen != prevlen) zip_bl_tree[curlen].fc++;
//         zip_bl_tree[zip_REP_3_6].fc++;
//       } else if (count <= 10) zip_bl_tree[zip_REPZ_3_10].fc++;
//       else zip_bl_tree[zip_REPZ_11_138].fc++;
//       count = 0;
//       prevlen = curlen;
//       if (nextlen == 0) {
//         max_count = 138;
//         min_count = 3;
//       } else if (curlen == nextlen) {
//         max_count = 6;
//         min_count = 3;
//       } else {
//         max_count = 7;
//         min_count = 4;
//       }
//     }
//   }

//   /* ==========================================================================
//    * Send a literal or distance tree in compressed form, using the codes in
//    * bl_tree.
//    */
//   function zip_send_tree(
//     tree, // the tree to be scanned
//     max_code
//   ) {
//     // and its largest code of non zero frequency
//     var n; // iterates over all tree elements
//     var prevlen = -1; // last emitted length
//     var curlen; // length of current code
//     var nextlen = tree[0].dl; // length of next code
//     var count = 0; // repeat count of the current code
//     var max_count = 7; // max repeat count
//     var min_count = 4; // min repeat count

//     /* tree[max_code+1].dl = -1; */ /* guard already set */
//     if (nextlen == 0) {
//       max_count = 138;
//       min_count = 3;
//     }

//     for (n = 0; n <= max_code; n++) {
//       curlen = nextlen;
//       nextlen = tree[n + 1].dl;
//       if (++count < max_count && curlen == nextlen) {
//         continue;
//       } else if (count < min_count) {
//         do {
//           zip_SEND_CODE(curlen, zip_bl_tree);
//         } while (--count != 0);
//       } else if (curlen != 0) {
//         if (curlen != prevlen) {
//           zip_SEND_CODE(curlen, zip_bl_tree);
//           count--;
//         }
//         // Assert(count >= 3 && count <= 6, " 3_6?");
//         zip_SEND_CODE(zip_REP_3_6, zip_bl_tree);
//         zip_send_bits(count - 3, 2);
//       } else if (count <= 10) {
//         zip_SEND_CODE(zip_REPZ_3_10, zip_bl_tree);
//         zip_send_bits(count - 3, 3);
//       } else {
//         zip_SEND_CODE(zip_REPZ_11_138, zip_bl_tree);
//         zip_send_bits(count - 11, 7);
//       }
//       count = 0;
//       prevlen = curlen;
//       if (nextlen == 0) {
//         max_count = 138;
//         min_count = 3;
//       } else if (curlen == nextlen) {
//         max_count = 6;
//         min_count = 3;
//       } else {
//         max_count = 7;
//         min_count = 4;
//       }
//     }
//   }

//   /* ==========================================================================
//    * Construct the Huffman tree for the bit lengths and return the index in
//    * bl_order of the last bit length code to send.
//    */
//   function zip_build_bl_tree() {
//     var max_blindex; // index of last bit length code of non zero freq

//     // Determine the bit length frequencies for literal and distance trees
//     zip_scan_tree(zip_dyn_ltree, zip_l_desc.max_code);
//     zip_scan_tree(zip_dyn_dtree, zip_d_desc.max_code);

//     // Build the bit length tree:
//     zip_build_tree(zip_bl_desc);
//     /* opt_len now includes the length of the tree representations, except
//      * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
//      */

//     /* Determine the number of bit length codes to send. The pkzip format
//      * requires that at least 4 bit length codes be sent. (appnote.txt says
//      * 3 but the actual value used is 4.)
//      */
//     for (max_blindex = zip_BL_CODES - 1; max_blindex >= 3; max_blindex--) {
//       if (zip_bl_tree[zip_bl_order[max_blindex]].dl != 0) break;
//     }
//     /* Update opt_len to include the bit length tree and counts */
//     zip_opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
//     //    Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
//     //	    encoder->opt_len, encoder->static_len));

//     return max_blindex;
//   }

//   /* ==========================================================================
//    * Send the header for a block using dynamic Huffman trees: the counts, the
//    * lengths of the bit length codes, the literal tree and the distance tree.
//    * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
//    */
//   function zip_send_all_trees(lcodes, dcodes, blcodes) {
//     // number of codes for each tree
//     var rank; // index in bl_order

//     //    Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
//     //    Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
//     //	    "too many codes");
//     //    Tracev((stderr, "\nbl counts: "));
//     zip_send_bits(lcodes - 257, 5); // not +255 as stated in appnote.txt
//     zip_send_bits(dcodes - 1, 5);
//     zip_send_bits(blcodes - 4, 4); // not -3 as stated in appnote.txt
//     for (rank = 0; rank < blcodes; rank++) {
//       //      Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
//       zip_send_bits(zip_bl_tree[zip_bl_order[rank]].dl, 3);
//     }

//     // send the literal tree
//     zip_send_tree(zip_dyn_ltree, lcodes - 1);

//     // send the distance tree
//     zip_send_tree(zip_dyn_dtree, dcodes - 1);
//   }

//   /* ==========================================================================
//    * Determine the best encoding for the current block: dynamic trees, static
//    * trees or store, and output the encoded block to the zip file.
//    */
//   function zip_flush_block(eof) {
//     // true if this is the last block for a file
//     var opt_lenb, static_lenb; // opt_len and static_len in bytes
//     var max_blindex; // index of last bit length code of non zero freq
//     var stored_len; // length of input block

//     stored_len = zip_strstart - zip_block_start;
//     zip_flag_buf[zip_last_flags] = zip_flags; // Save the flags for the last 8 items

//     // Construct the literal and distance trees
//     zip_build_tree(zip_l_desc);
//     //    Tracev((stderr, "\nlit data: dyn %ld, stat %ld",
//     //	    encoder->opt_len, encoder->static_len));

//     zip_build_tree(zip_d_desc);
//     //    Tracev((stderr, "\ndist data: dyn %ld, stat %ld",
//     //	    encoder->opt_len, encoder->static_len));
//     /* At this point, opt_len and static_len are the total bit lengths of
//      * the compressed block data, excluding the tree representations.
//      */

//     /* Build the bit length tree for the above two trees, and get the index
//      * in bl_order of the last bit length code to send.
//      */
//     max_blindex = zip_build_bl_tree();

//     // Determine the best encoding. Compute first the block length in bytes
//     opt_lenb = (zip_opt_len + 3 + 7) >> 3;
//     static_lenb = (zip_static_len + 3 + 7) >> 3;

//     //    Trace((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u dist %u ",
//     //	   opt_lenb, encoder->opt_len,
//     //	   static_lenb, encoder->static_len, stored_len,
//     //	   encoder->last_lit, encoder->last_dist));

//     if (static_lenb <= opt_lenb) opt_lenb = static_lenb;
//     if (
//       stored_len + 4 <= opt_lenb && // 4: two words for the lengths
//       zip_block_start >= 0
//     ) {
//       var i;

//       /* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
//        * Otherwise we can't have processed more than WSIZE input bytes since
//        * the last block flush, because compression would have been
//        * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
//        * transform a block into a stored block.
//        */
//       zip_send_bits((zip_STORED_BLOCK << 1) + eof, 3); /* send block type */
//       zip_bi_windup(); /* align on byte boundary */
//       zip_put_short(stored_len);
//       zip_put_short(~stored_len);

//       // copy block
//       /*
//           p = &window[block_start];
//           for(i = 0; i < stored_len; i++)
//         put_byte(p[i]);
//     */
//       for (i = 0; i < stored_len; i++)
//         zip_put_byte(zip_window[zip_block_start + i]);
//     } else if (static_lenb == opt_lenb) {
//       zip_send_bits((zip_STATIC_TREES << 1) + eof, 3);
//       zip_compress_block(zip_static_ltree, zip_static_dtree);
//     } else {
//       zip_send_bits((zip_DYN_TREES << 1) + eof, 3);
//       zip_send_all_trees(
//         zip_l_desc.max_code + 1,
//         zip_d_desc.max_code + 1,
//         max_blindex + 1
//       );
//       zip_compress_block(zip_dyn_ltree, zip_dyn_dtree);
//     }

//     zip_init_block();

//     if (eof != 0) zip_bi_windup();
//   }

//   /* ==========================================================================
//    * Save the match info and tally the frequency counts. Return true if
//    * the current block must be flushed.
//    */
//   function zip_ct_tally(
//     dist, // distance of matched string
//     lc
//   ) {
//     // match length-MIN_MATCH or unmatched char (if dist==0)
//     zip_l_buf[zip_last_lit++] = lc;
//     if (dist == 0) {
//       // lc is the unmatched char
//       zip_dyn_ltree[lc].fc++;
//     } else {
//       // Here, lc is the match length - MIN_MATCH
//       dist--; // dist = match distance - 1
//       //      Assert((ush)dist < (ush)MAX_DIST &&
//       //	     (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
//       //	     (ush)D_CODE(dist) < (ush)D_CODES,  "ct_tally: bad match");

//       zip_dyn_ltree[zip_length_code[lc] + zip_LITERALS + 1].fc++;
//       zip_dyn_dtree[zip_D_CODE(dist)].fc++;

//       zip_d_buf[zip_last_dist++] = dist;
//       zip_flags |= zip_flag_bit;
//     }
//     zip_flag_bit <<= 1;

//     // Output the flags if they fill a byte
//     if ((zip_last_lit & 7) == 0) {
//       zip_flag_buf[zip_last_flags++] = zip_flags;
//       zip_flags = 0;
//       zip_flag_bit = 1;
//     }
//     // Try to guess if it is profitable to stop the current block here
//     if (zip_compr_level > 2 && (zip_last_lit & 0xfff) == 0) {
//       // Compute an upper bound for the compressed length
//       var out_length = zip_last_lit * 8;
//       var in_length = zip_strstart - zip_block_start;
//       var dcode;

//       for (dcode = 0; dcode < zip_D_CODES; dcode++) {
//         out_length += zip_dyn_dtree[dcode].fc * (5 + zip_extra_dbits[dcode]);
//       }
//       out_length >>= 3;
//       //      Trace((stderr,"\nlast_lit %u, last_dist %u, in %ld, out ~%ld(%ld%%) ",
//       //	     encoder->last_lit, encoder->last_dist, in_length, out_length,
//       //	     100L - out_length*100L/in_length));
//       if (
//         zip_last_dist < parseInt(zip_last_lit / 2) &&
//         out_length < parseInt(in_length / 2)
//       )
//         return true;
//     }
//     return (
//       zip_last_lit == zip_LIT_BUFSIZE - 1 || zip_last_dist == zip_DIST_BUFSIZE
//     );
//     /* We avoid equality with LIT_BUFSIZE because of wraparound at 64K
//      * on 16 bit machines and because stored blocks are restricted to
//      * 64K-1 bytes.
//      */
//   }

//   /* ==========================================================================
//    * Send the block data compressed using the given Huffman trees
//    */
//   function zip_compress_block(
//     ltree, // literal tree
//     dtree
//   ) {
//     // distance tree
//     var dist; // distance of matched string
//     var lc; // match length or unmatched char (if dist == 0)
//     var lx = 0; // running index in l_buf
//     var dx = 0; // running index in d_buf
//     var fx = 0; // running index in flag_buf
//     var flag = 0; // current flags
//     var code; // the code to send
//     var extra; // number of extra bits to send

//     if (zip_last_lit != 0)
//       do {
//         if ((lx & 7) == 0) flag = zip_flag_buf[fx++];
//         lc = zip_l_buf[lx++] & 0xff;
//         if ((flag & 1) == 0) {
//           zip_SEND_CODE(lc, ltree); /* send a literal byte */
//           //	Tracecv(isgraph(lc), (stderr," '%c' ", lc));
//         } else {
//           // Here, lc is the match length - MIN_MATCH
//           code = zip_length_code[lc];
//           zip_SEND_CODE(code + zip_LITERALS + 1, ltree); // send the length code
//           extra = zip_extra_lbits[code];
//           if (extra != 0) {
//             lc -= zip_base_length[code];
//             zip_send_bits(lc, extra); // send the extra length bits
//           }
//           dist = zip_d_buf[dx++];
//           // Here, dist is the match distance - 1
//           code = zip_D_CODE(dist);
//           //	Assert (code < D_CODES, "bad d_code");

//           zip_SEND_CODE(code, dtree); // send the distance code
//           extra = zip_extra_dbits[code];
//           if (extra != 0) {
//             dist -= zip_base_dist[code];
//             zip_send_bits(dist, extra); // send the extra distance bits
//           }
//         } // literal or match pair ?
//         flag >>= 1;
//       } while (lx < zip_last_lit);

//     zip_SEND_CODE(zip_END_BLOCK, ltree);
//   }

//   /* ==========================================================================
//    * Send a value on a given number of bits.
//    * IN assertion: length <= 16 and value fits in length bits.
//    */
//   var zip_Buf_size = 16; // bit size of bi_buf
//   function zip_send_bits(
//     value, // value to send
//     length
//   ) {
//     // number of bits
//     /* If not enough room in bi_buf, use (valid) bits from bi_buf and
//      * (16 - bi_valid) bits from value, leaving (width - (16-bi_valid))
//      * unused bits in value.
//      */
//     if (zip_bi_valid > zip_Buf_size - length) {
//       zip_bi_buf |= value << zip_bi_valid;
//       zip_put_short(zip_bi_buf);
//       zip_bi_buf = value >> (zip_Buf_size - zip_bi_valid);
//       zip_bi_valid += length - zip_Buf_size;
//     } else {
//       zip_bi_buf |= value << zip_bi_valid;
//       zip_bi_valid += length;
//     }
//   }

//   /* ==========================================================================
//    * Reverse the first len bits of a code, using straightforward code (a faster
//    * method would use a table)
//    * IN assertion: 1 <= len <= 15
//    */
//   function zip_bi_reverse(
//     code, // the value to invert
//     len
//   ) {
//     // its bit length
//     var res = 0;
//     do {
//       res |= code & 1;
//       code >>= 1;
//       res <<= 1;
//     } while (--len > 0);
//     return res >> 1;
//   }

//   /* ==========================================================================
//    * Write out any remaining bits in an incomplete byte.
//    */
//   function zip_bi_windup() {
//     if (zip_bi_valid > 8) {
//       zip_put_short(zip_bi_buf);
//     } else if (zip_bi_valid > 0) {
//       zip_put_byte(zip_bi_buf);
//     }
//     zip_bi_buf = 0;
//     zip_bi_valid = 0;
//   }

//   function zip_qoutbuf() {
//     if (zip_outcnt != 0) {
//       var q, i;
//       q = zip_new_queue();
//       if (zip_qhead == null) zip_qhead = zip_qtail = q;
//       else zip_qtail = zip_qtail.next = q;
//       q.len = zip_outcnt - zip_outoff;
//       //      System.arraycopy(zip_outbuf, zip_outoff, q.ptr, 0, q.len);
//       for (i = 0; i < q.len; i++) q.ptr[i] = zip_outbuf[zip_outoff + i];
//       zip_outcnt = zip_outoff = 0;
//     }
//   }

//   return function deflate(str, level) {
//     var i, j;

//     zip_deflate_data = str;
//     zip_deflate_pos = 0;
//     if (typeof level == "undefined") level = zip_DEFAULT_LEVEL;
//     zip_deflate_start(level);

//     var buff = new Array(1024);
//     var aout = [];
//     while ((i = zip_deflate_internal(buff, 0, buff.length)) > 0) {
//       var cbuf = new Array(i);
//       for (j = 0; j < i; j++) {
//         cbuf[j] = String.fromCharCode(buff[j]);
//       }
//       aout[aout.length] = cbuf.join("");
//     }
//     zip_deflate_data = null; // G.C.
//     return aout.join("");
//   };
// })();

// onmessage = function worker(m) {
//   postMessage(deflate(m.data, 9));
// };

// onconnect = function sharedWorker(e) {
//   var port = e.ports[0];
//   port.onmessage = function (m) {
//     port.postMessage(deflate(m.data, 9));
//   };
// };

var deflate = (function () {
  function ai() {
    this.fc = 0;
    this.dl = 0;
  }
  function gr() {
    this.dyn_tree = null;
    this.static_tree = null;
    this.extra_bits = null;
    this.extra_base = 0;
    this.elems = 0;
    this.max_length = 0;
    this.max_code = 0;
  }
  function rt(n, t, i, r) {
    this.good_length = n;
    this.max_lazy = t;
    this.nice_length = i;
    this.max_chain = r;
  }
  function te() {
    this.next = null;
    this.len = 0;
    this.ptr = new Array(pi);
    this.off = 0;
  }
  function re(t) {
    var r;
    if (
      (t ? (t < 1 ? (t = 1) : t > 9 && (t = 9)) : (t = fu),
      (pt = t),
      (wr = !1),
      (et = !1),
      at == null)
    ) {
      for (
        lt = e = ei = null,
          at = new Array(pi),
          n = new Array(ou),
          gi = new Array(hu),
          nr = new Array(bf + kf),
          ut = new Array(1 << df),
          b = new Array(ki),
          r = 0;
        r < ki;
        r++
      )
        b[r] = new ai();
      for (nt = new Array(2 * k + 1), r = 0; r < 2 * k + 1; r++)
        nt[r] = new ai();
      for (tt = new Array(ct + 2), r = 0; r < ct + 2; r++) tt[r] = new ai();
      for (wt = new Array(k), r = 0; r < k; r++) wt[r] = new ai();
      for (o = new Array(2 * fi + 1), r = 0; r < 2 * fi + 1; r++)
        o[r] = new ai();
      v = new gr();
      y = new gr();
      it = new gr();
      c = new Array(kt + 1);
      i = new Array(2 * ct + 1);
      p = new Array(2 * ct + 1);
      ni = new Array(dt - h + 1);
      ti = new Array(512);
      tr = new Array(yr);
      hi = new Array(k);
      ci = new Array(parseInt(lr / 8));
    }
  }
  function ue(n) {
    n.next = lt;
    lt = n;
  }
  function fe() {
    var n;
    return (
      lt != null ? ((n = lt), (lt = lt.next)) : (n = new te()),
      (n.next = null),
      (n.len = n.off = 0),
      n
    );
  }
  function gu(n) {
    return ut[f + n];
  }
  function nf(n, t) {
    return (ut[f + n] = t);
  }
  function or(n) {
    at[s + l++] = n;
    s + l == pi && pe();
  }
  function sr(n) {
    n &= 65535;
    s + l < pi - 2
      ? ((at[s + l++] = n & 255), (at[s + l++] = n >>> 8))
      : (or(n & 255), or(n >>> 8));
  }
  function hr() {
    g = ((g << pr) ^ (n[t + h - 1] & 255)) & vr;
    yt = gu(g);
    ut[t & cu] = yt;
    nf(g, t);
  }
  function ht(n, t) {
    a(t[n].fc, t[n].dl);
  }
  function tf(n) {
    return (n < 256 ? ti[n] : ti[256 + (n >> 7)]) & 255;
  }
  function rf(n, t, i) {
    return n[t].fc < n[i].fc || (n[t].fc == n[i].fc && p[t] <= p[i]);
  }
  function uf(n, t, i) {
    for (var r = 0; r < i && dr < fr.length; r++)
      n[t + r] = fr.charCodeAt(dr++) & 255;
    return r;
  }
  function ee() {
    for (var i = 0; i < ar; i++) ut[f + i] = 0;
    if (
      ((br = er[pt].max_lazy),
      (bu = er[pt].good_length),
      eu || (ku = er[pt].nice_length),
      (wu = er[pt].max_chain),
      (t = 0),
      (ft = 0),
      (u = uf(n, 0, 2 * f)),
      u <= 0)
    ) {
      et = !0;
      u = 0;
      return;
    }
    for (et = !1; u < wi && !et; ) tu();
    for (g = 0, i = 0; i < h - 1; i++) g = ((g << pr) ^ (n[i] & 255)) & vr;
  }
  function ff(i) {
    var s = wu,
      r = t,
      u,
      e,
      f = w,
      l = t > ui ? t - ui : ri,
      o = t + dt,
      h = n[r + f - 1],
      c = n[r + f];
    w >= bu && (s >>= 2);
    do
      if (
        ((u = i),
        n[u + f] == c &&
          n[u + f - 1] == h &&
          n[u] == n[r] &&
          n[++u] == n[r + 1])
      ) {
        r += 2;
        u++;
        do;
        while (
          n[++r] == n[++u] &&
          n[++r] == n[++u] &&
          n[++r] == n[++u] &&
          n[++r] == n[++u] &&
          n[++r] == n[++u] &&
          n[++r] == n[++u] &&
          n[++r] == n[++u] &&
          n[++r] == n[++u] &&
          r < o
        );
        if (((e = dt - (o - r)), (r = o - dt), e > f)) {
          if (((si = i), (f = e), eu)) {
            if (e >= dt) break;
          } else if (e >= ku) break;
          h = n[r + f - 1];
          c = n[r + f];
        }
      }
    while ((i = ut[i & cu]) > l && --s != 0);
    return f;
  }
  function tu() {
    var i,
      r,
      e = ou - u - t;
    if (e == -1) e--;
    else if (t >= f + ui) {
      for (i = 0; i < f; i++) n[i] = n[i + f];
      for (si -= f, t -= f, ft -= f, i = 0; i < ar; i++)
        (r = gu(i)), nf(i, r >= f ? r - f : ri);
      for (i = 0; i < f; i++) (r = ut[i]), (ut[i] = r >= f ? r - f : ri);
      e += f;
    }
    et || ((i = uf(n, t + u, e)), i <= 0 ? (et = !0) : (u += i));
  }
  function oe() {
    while (u != 0 && e == null) {
      var i;
      if (
        (hr(),
        yt != ri && t - yt <= ui && ((r = ff(yt)), r > u && (r = u)),
        r >= h)
      )
        if (((i = yi(t - si, r - h)), (u -= r), r <= br)) {
          r--;
          do t++, hr();
          while (--r != 0);
          t++;
        } else
          (t += r),
            (r = 0),
            (g = n[t] & 255),
            (g = ((g << pr) ^ (n[t + 1] & 255)) & vr);
      else (i = yi(0, n[t] & 255)), u--, t++;
      for (i && (cr(0), (ft = t)); u < wi && !et; ) tu();
    }
  }
  function se() {
    while (u != 0 && e == null) {
      if (
        (hr(),
        (w = r),
        (pu = si),
        (r = h - 1),
        yt != ri &&
          w < br &&
          t - yt <= ui &&
          ((r = ff(yt)), r > u && (r = u), r == h && t - si > gf && r--),
        w >= h && r <= w)
      ) {
        var i;
        i = yi(t - 1 - pu, w - h);
        u -= w - 1;
        w -= 2;
        do t++, hr();
        while (--w != 0);
        oi = 0;
        r = h - 1;
        t++;
        i && (cr(0), (ft = t));
      } else
        oi != 0
          ? (yi(0, n[t - 1] & 255) && (cr(0), (ft = t)), t++, u--)
          : ((oi = 1), t++, u--);
      while (u < wi && !et) tu();
    }
  }
  function he() {
    et ||
      ((vt = 0),
      (d = 0),
      le(),
      ee(),
      (e = null),
      (l = 0),
      (s = 0),
      pt <= 3 ? ((w = h - 1), (r = 0)) : ((r = h - 1), (oi = 0)),
      (di = !1));
  }
  function ce(i, r, f) {
    var e;
    return !wr && (he(), (wr = !0), u == 0)
      ? ((di = !0), 0)
      : (e = ef(i, r, f)) == f
      ? f
      : di
      ? e
      : (pt <= 3 ? oe() : se(),
        u == 0 && (oi != 0 && yi(0, n[t - 1] & 255), cr(1), (di = !0)),
        e + ef(i, e + r, f - e));
  }
  function ef(n, t, i) {
    for (var r, f, o, u = 0; e != null && u < i; ) {
      for (r = i - u, r > e.len && (r = e.len), f = 0; f < r; f++)
        n[t + u + f] = e.ptr[e.off + f];
      e.off += r;
      e.len -= r;
      u += r;
      e.len == 0 && ((o = e), (e = e.next), ue(o));
    }
    if (u == i) return u;
    if (s < l) {
      for (r = i - u, r > l - s && (r = l - s), f = 0; f < r; f++)
        n[t + u + f] = at[s + f];
      s += r;
      u += r;
      l == s && (l = s = 0);
    }
    return u;
  }
  function le() {
    var n, r, u, t, i;
    if (wt[0].dl == 0) {
      for (
        v.dyn_tree = b,
          v.static_tree = tt,
          v.extra_bits = nu,
          v.extra_base = bi + 1,
          v.elems = ct,
          v.max_length = kt,
          v.max_code = 0,
          y.dyn_tree = nt,
          y.static_tree = wt,
          y.extra_bits = vi,
          y.extra_base = 0,
          y.elems = k,
          y.max_length = kt,
          y.max_code = 0,
          it.dyn_tree = o,
          it.static_tree = null,
          it.extra_bits = ie,
          it.extra_base = 0,
          it.elems = fi,
          it.max_length = ne,
          it.max_code = 0,
          u = 0,
          t = 0;
        t < yr - 1;
        t++
      )
        for (tr[t] = u, n = 0; n < 1 << nu[t]; n++) ni[u++] = t;
      for (ni[u - 1] = t, i = 0, t = 0; t < 16; t++)
        for (hi[t] = i, n = 0; n < 1 << vi[t]; n++) ti[i++] = t;
      for (i >>= 7; t < k; t++)
        for (hi[t] = i << 7, n = 0; n < 1 << (vi[t] - 7); n++)
          ti[256 + i++] = t;
      for (r = 0; r <= kt; r++) c[r] = 0;
      for (n = 0; n <= 143; ) (tt[n++].dl = 8), c[8]++;
      while (n <= 255) (tt[n++].dl = 9), c[9]++;
      while (n <= 279) (tt[n++].dl = 7), c[7]++;
      while (n <= 287) (tt[n++].dl = 8), c[8]++;
      for (sf(tt, ct + 1), n = 0; n < k; n++)
        (wt[n].dl = 5), (wt[n].fc = af(n, 5));
      of();
    }
  }
  function of() {
    for (var n = 0; n < ct; n++) b[n].fc = 0;
    for (n = 0; n < k; n++) nt[n].fc = 0;
    for (n = 0; n < fi; n++) o[n].fc = 0;
    b[lu].fc = 1;
    ii = ur = 0;
    st = ir = kr = 0;
    li = 0;
    rr = 1;
  }
  function iu(n, t) {
    for (var u = i[t], r = t << 1; r <= ot; ) {
      if ((r < ot && rf(n, i[r + 1], i[r]) && r++, rf(n, u, i[r]))) break;
      i[t] = i[r];
      t = r;
      r <<= 1;
    }
    i[t] = u;
  }
  function ae(n) {
    for (
      var u = n.dyn_tree,
        p = n.extra_bits,
        a = n.extra_base,
        v = n.max_code,
        e = n.max_length,
        y = n.static_tree,
        o,
        r,
        f,
        s,
        l,
        h = 0,
        t = 0;
      t <= kt;
      t++
    )
      c[t] = 0;
    for (u[i[gt]].dl = 0, o = gt + 1; o < ki; o++)
      ((r = i[o]),
      (t = u[u[r].dl].dl + 1),
      t > e && ((t = e), h++),
      (u[r].dl = t),
      r > v) ||
        (c[t]++,
        (s = 0),
        r >= a && (s = p[r - a]),
        (l = u[r].fc),
        (ii += l * (t + s)),
        y != null && (ur += l * (y[r].dl + s)));
    if (h != 0) {
      do {
        for (t = e - 1; c[t] == 0; ) t--;
        c[t]--;
        c[t + 1] += 2;
        c[e]--;
        h -= 2;
      } while (h > 0);
      for (t = e; t != 0; t--)
        for (r = c[t]; r != 0; )
          ((f = i[--o]), f > v) ||
            (u[f].dl != t && ((ii += (t - u[f].dl) * u[f].fc), (u[f].fc = t)),
            r--);
    }
  }
  function sf(n, t) {
    for (var e = new Array(kt + 1), f = 0, r, u, i = 1; i <= kt; i++)
      (f = (f + c[i - 1]) << 1), (e[i] = f);
    for (r = 0; r <= t; r++)
      ((u = n[r].dl), u != 0) && (n[r].fc = af(e[u]++, u));
  }
  function ru(n) {
    var r = n.dyn_tree,
      s = n.static_tree,
      h = n.elems,
      t,
      u,
      f = -1,
      e = h,
      o;
    for (ot = 0, gt = ki, t = 0; t < h; t++)
      r[t].fc != 0 ? ((i[++ot] = f = t), (p[t] = 0)) : (r[t].dl = 0);
    while (ot < 2)
      (o = i[++ot] = f < 2 ? ++f : 0),
        (r[o].fc = 1),
        (p[o] = 0),
        ii--,
        s != null && (ur -= s[o].dl);
    for (n.max_code = f, t = ot >> 1; t >= 1; t--) iu(r, t);
    do
      (t = i[bt]),
        (i[bt] = i[ot--]),
        iu(r, bt),
        (u = i[bt]),
        (i[--gt] = t),
        (i[--gt] = u),
        (r[e].fc = r[t].fc + r[u].fc),
        (p[e] = p[t] > p[u] + 1 ? p[t] : p[u] + 1),
        (r[t].dl = r[u].dl = e),
        (i[bt] = e++),
        iu(r, bt);
    while (ot >= 2);
    i[--gt] = i[bt];
    ae(n);
    sf(r, f);
  }
  function hf(n, t) {
    var s,
      h = -1,
      i,
      r = n[0].dl,
      u = 0,
      f = 7,
      e = 4;
    for (
      r == 0 && ((f = 138), (e = 3)), n[t + 1].dl = 65535, s = 0;
      s <= t;
      s++
    ) {
      if (((i = r), (r = n[s + 1].dl), ++u < f && i == r)) continue;
      else
        u < e
          ? (o[i].fc += u)
          : i != 0
          ? (i != h && o[i].fc++, o[au].fc++)
          : u <= 10
          ? o[vu].fc++
          : o[yu].fc++;
      u = 0;
      h = i;
      r == 0
        ? ((f = 138), (e = 3))
        : i == r
        ? ((f = 6), (e = 3))
        : ((f = 7), (e = 4));
    }
  }
  function cf(n, t) {
    var s,
      h = -1,
      r,
      u = n[0].dl,
      i = 0,
      f = 7,
      e = 4;
    for (u == 0 && ((f = 138), (e = 3)), s = 0; s <= t; s++) {
      if (((r = u), (u = n[s + 1].dl), ++i < f && r == u)) continue;
      else if (i < e) {
        do ht(r, o);
        while (--i != 0);
      } else
        r != 0
          ? (r != h && (ht(r, o), i--), ht(au, o), a(i - 3, 2))
          : i <= 10
          ? (ht(vu, o), a(i - 3, 3))
          : (ht(yu, o), a(i - 11, 7));
      i = 0;
      h = r;
      u == 0
        ? ((f = 138), (e = 3))
        : r == u
        ? ((f = 6), (e = 3))
        : ((f = 7), (e = 4));
    }
  }
  function ve() {
    var n;
    for (hf(b, v.max_code), hf(nt, y.max_code), ru(it), n = fi - 1; n >= 3; n--)
      if (o[du[n]].dl != 0) break;
    return (ii += 3 * (n + 1) + 5 + 5 + 4), n;
  }
  function ye(n, t, i) {
    var r;
    for (a(n - 257, 5), a(t - 1, 5), a(i - 4, 4), r = 0; r < i; r++)
      a(o[du[r]].dl, 3);
    cf(b, n - 1);
    cf(nt, t - 1);
  }
  function cr(i) {
    var r, f, o, u, e;
    if (
      ((u = t - ft),
      (ci[kr] = li),
      ru(v),
      ru(y),
      (o = ve()),
      (r = (ii + 3 + 7) >> 3),
      (f = (ur + 3 + 7) >> 3),
      f <= r && (r = f),
      u + 4 <= r && ft >= 0)
    )
      for (a((yf << 1) + i, 3), vf(), sr(u), sr(~u), e = 0; e < u; e++)
        or(n[ft + e]);
    else
      f == r
        ? (a((pf << 1) + i, 3), lf(tt, wt))
        : (a((wf << 1) + i, 3),
          ye(v.max_code + 1, y.max_code + 1, o + 1),
          lf(b, nt));
    of();
    i != 0 && vf();
  }
  function yi(n, i) {
    if (
      ((nr[st++] = i),
      n == 0
        ? b[i].fc++
        : (n--,
          b[ni[i] + bi + 1].fc++,
          nt[tf(n)].fc++,
          (gi[ir++] = n),
          (li |= rr)),
      (rr <<= 1),
      (st & 7) == 0 && ((ci[kr++] = li), (li = 0), (rr = 1)),
      pt > 2 && (st & 4095) == 0)
    ) {
      for (var u = st * 8, f = t - ft, r = 0; r < k; r++)
        u += nt[r].fc * (5 + vi[r]);
      if (((u >>= 3), ir < parseInt(st / 2) && u < parseInt(f / 2))) return !0;
    }
    return st == lr - 1 || ir == hu;
  }
  function lf(n, t) {
    var f,
      u,
      e = 0,
      s = 0,
      h = 0,
      o = 0,
      i,
      r;
    if (st != 0)
      do
        (e & 7) == 0 && (o = ci[h++]),
          (u = nr[e++] & 255),
          (o & 1) == 0
            ? ht(u, n)
            : ((i = ni[u]),
              ht(i + bi + 1, n),
              (r = nu[i]),
              r != 0 && ((u -= tr[i]), a(u, r)),
              (f = gi[s++]),
              (i = tf(f)),
              ht(i, t),
              (r = vi[i]),
              r != 0 && ((f -= hi[i]), a(f, r))),
          (o >>= 1);
      while (e < st);
    ht(lu, n);
  }
  function a(n, t) {
    d > uu - t
      ? ((vt |= n << d), sr(vt), (vt = n >> (uu - d)), (d += t - uu))
      : ((vt |= n << d), (d += t));
  }
  function af(n, t) {
    var i = 0;
    do (i |= n & 1), (n >>= 1), (i <<= 1);
    while (--t > 0);
    return i >> 1;
  }
  function vf() {
    d > 8 ? sr(vt) : d > 0 && or(vt);
    vt = 0;
    d = 0;
  }
  function pe() {
    if (l != 0) {
      var n, t;
      for (
        n = fe(),
          e == null ? (e = ei = n) : (ei = ei.next = n),
          n.len = l - s,
          t = 0;
        t < n.len;
        t++
      )
        n.ptr[t] = at[s + t];
      l = s = 0;
    }
  }
  var f = 32768,
    yf = 0,
    pf = 1,
    wf = 2,
    fu = 6,
    eu = !0,
    bf = 32768,
    kf = 64,
    pi = 8192,
    ou = 2 * f,
    h = 3,
    dt = 258,
    df = 16,
    lr = 8192,
    su = 13,
    hu = lr,
    ar = 1 << su,
    vr = ar - 1,
    cu = f - 1,
    ri = 0,
    gf = 4096,
    wi = dt + h + 1,
    ui = f - wi,
    bt = 1,
    kt = 15,
    ne = 7,
    yr = 29,
    bi = 256,
    lu = 256,
    ct = bi + 1 + yr,
    k = 30,
    fi = 19,
    au = 16,
    vu = 17,
    yu = 18,
    ki = 2 * ct + 1,
    pr = parseInt((su + h - 1) / h),
    lt,
    e,
    ei,
    wr,
    at = null,
    l,
    s,
    di,
    n,
    gi,
    nr,
    ut,
    vt,
    d,
    ft,
    g,
    yt,
    pu,
    oi,
    r,
    w,
    t,
    si,
    et,
    u,
    wu,
    br,
    pt,
    bu,
    ku,
    b,
    nt,
    tt,
    wt,
    o,
    v,
    y,
    it,
    c,
    i,
    ot,
    gt,
    p,
    ni,
    ti,
    tr,
    hi,
    ci,
    st,
    ir,
    kr,
    li,
    rr,
    ii,
    ur,
    fr,
    dr,
    nu = [
      0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5,
      5, 5, 5, 0,
    ],
    vi = [
      0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10,
      11, 11, 12, 12, 13, 13,
    ],
    ie = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7],
    du = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
    er = [
      new rt(0, 0, 0, 0),
      new rt(4, 4, 8, 4),
      new rt(4, 5, 16, 8),
      new rt(4, 6, 32, 32),
      new rt(4, 4, 16, 16),
      new rt(8, 16, 32, 32),
      new rt(8, 16, 128, 128),
      new rt(8, 32, 128, 256),
      new rt(32, 128, 258, 1024),
      new rt(32, 258, 258, 4096),
    ],
    uu = 16;
  return function (n, t) {
    var f, i, r, u, e;
    for (
      fr = n,
        dr = 0,
        typeof t == "undefined" && (t = fu),
        re(t),
        r = new Array(1024),
        u = [];
      (f = ce(r, 0, r.length)) > 0;

    ) {
      for (e = new Array(f), i = 0; i < f; i++)
        e[i] = String.fromCharCode(r[i]);
      u[u.length] = e.join("");
    }
    return (fr = null), u.join("");
  };
})();

module.exports = deflate;
