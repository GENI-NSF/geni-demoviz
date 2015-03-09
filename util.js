

/**
 * This function is based on an example at:
 * http://www.designchemical.com/blog/index.php/jquery/8-useful-jquery-snippets-for-urls-querystrings/
 */
function getURLParameters()
{
    var vars = {};
    var param;
    var q = document.URL.split('?')[1];
    if (q != undefined) {
        // Lop off an anchor if it exists.
        q = q.split('#')[0];
        q = q.split('&');
        for (var i = 0; i < q.length; i++) {
            param = q[i].split('=');
            vars[param[0]] = param[1];
        }
    }
    return vars;
}
